import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PaymentReconciliationService } from "../../apps/api/src/scheduler/payment-reconciliation.service.js";
import {
  cart,
  customer,
  orderAndPayment,
  signedIpn,
  startTestApp,
  type TestApp,
} from "./support.js";

describe("Task 5.2 HTTP integration / real PostgreSQL / simulated payment provider", () => {
  let context: TestApp;
  beforeAll(async () => {
    context = await startTestApp();
  });
  afterAll(async () => {
    await context?.app.close();
  });

  it("serves readiness against real PostgreSQL and rejects missing/invalid JWT", async () => {
    await context.http
      .get("/health/ready")
      .expect(200, { status: "ready", database: "up" });
    await context.http.get("/orders").expect(401);
    await context.http
      .get("/orders")
      .set("Authorization", "Bearer invalid")
      .expect(401);
  });

  it("prices size/topping on the server, persists payment once, settles duplicate IPN once", async () => {
    const { user, order, payment, key } = await orderAndPayment(context);
    expect(order.totalAmount).toBe(42000);
    expect(payment.amount).toBe(42000);
    const repeat = await context.http
      .post(`/orders/${order.id}/payments`)
      .set("Authorization", user.authorization)
      .set("Idempotency-Key", key)
      .send({})
      .expect(201);
    expect(repeat.body.paymentId).toBe(payment.paymentId);
    expect(
      await context.db.payment.count({ where: { orderId: order.id } }),
    ).toBe(1);
    const url = `/payments/vnpay/ipn?${signedIpn(payment)}`;
    expect((await context.http.get(url).expect(200)).body.RspCode).toBe("00");
    expect((await context.http.get(url).expect(200)).body.RspCode).toBe("02");
    expect(
      (await context.db.order.findUniqueOrThrow({ where: { id: order.id } }))
        .status,
    ).toBe("PAID");
    expect(
      await context.db.loyaltyTransaction.count({
        where: { orderId: order.id, type: "EARN" },
      }),
    ).toBe(1);
    const usages = await context.db.orderIngredientUsage.findMany({
      where: { orderItem: { orderId: order.id } },
    });
    expect(usages.length).toBeGreaterThan(0);
    const balances = await context.db.ingredient.findMany({
      orderBy: { id: "asc" },
    });
    await context.http.get(url).expect(200);
    expect(
      await context.db.ingredient.findMany({ orderBy: { id: "asc" } }),
    ).toEqual(balances);
  });

  it("enforces ownership, customer roles, and rejects client payment amount", async () => {
    const { user, order } = await orderAndPayment(context);
    const other = await customer(context);
    await context.http
      .get(`/orders/${order.id}`)
      .set("Authorization", other.authorization)
      .expect(404);
    await context.http
      .post(`/orders/${order.id}/payments`)
      .set("Authorization", other.authorization)
      .send({})
      .expect(404);
    await context.http
      .get("/staff/orders")
      .set("Authorization", user.authorization)
      .expect(403);
    await context.http
      .post(`/orders/${order.id}/payments`)
      .set("Authorization", user.authorization)
      .send({ amount: 1 })
      .expect(400);
  });

  it("rolls back order/items and retains cart when stock check fails after order insert", async () => {
    const user = await customer(context);
    await cart(context, user.authorization);
    const ingredient = await context.db.ingredient.findUniqueOrThrow({
      where: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" },
    });
    await context.db.ingredient.update({
      where: { id: ingredient.id },
      data: { quantityOnHand: 0 },
    });
    try {
      await context.http
        .post("/orders")
        .set("Authorization", user.authorization)
        .send({})
        .expect(409);
      expect(
        await context.db.order.count({ where: { userId: user.user.id } }),
      ).toBe(0);
      expect(
        await context.db.cartItem.count({
          where: { cart: { userId: user.user.id } },
        }),
      ).toBe(1);
    } finally {
      await context.db.ingredient.update({
        where: { id: ingredient.id },
        data: { quantityOnHand: ingredient.quantityOnHand },
      });
    }
  });

  it("rejects invalid signatures and amount mismatches without changing payment", async () => {
    const { payment } = await orderAndPayment(context);
    const invalid = signedIpn(payment).replace(
      /vnp_SecureHash=.*/,
      `vnp_SecureHash=${"0".repeat(128)}`,
    );
    expect(
      (await context.http.get(`/payments/vnpay/ipn?${invalid}`)).body.RspCode,
    ).toBe("97");
    expect(
      (
        await context.http.get(
          `/payments/vnpay/ipn?${signedIpn(payment, { vnp_Amount: "100" })}`,
        )
      ).body.RspCode,
    ).toBe("04");
    expect(
      (
        await context.db.payment.findUniqueOrThrow({
          where: { id: payment.paymentId },
        })
      ).status,
    ).toBe("PENDING");
  });

  it("records a failed payment without deducting inventory", async () => {
    const { order, payment } = await orderAndPayment(context);
    await context.http
      .get(
        `/payments/vnpay/ipn?${signedIpn(payment, { vnp_ResponseCode: "24", vnp_TransactionStatus: "02" })}`,
      )
      .expect(200);
    expect(
      (await context.db.order.findUniqueOrThrow({ where: { id: order.id } }))
        .status,
    ).toBe("PAYMENT_FAILED");
    expect(
      await context.db.orderIngredientUsage.count({
        where: { orderItem: { orderId: order.id } },
      }),
    ).toBe(0);
  });

  it("keeps UNKNOWN unresolved until QueryDR verifies success", async () => {
    const { payment, order } = await orderAndPayment(context);
    await context.db.payment.update({
      where: { id: payment.paymentId },
      data: { status: "UNKNOWN", nextQueryAt: new Date(0) },
    });
    const query = vi
      .spyOn(context.gateway, "queryTransaction")
      .mockImplementation(async (input) =>
        input.transactionRef === payment.transactionRef
          ? {
              transactionRef: payment.transactionRef,
              amount: payment.amount,
              status: "SUCCEEDED",
              responseCode: "00",
              transactionStatus: "00",
              providerTransactionNo: "query-test",
              bankCode: "NCB",
              payDate: "20261115171500",
            }
          : null,
      );
    try {
      await context.app.get(PaymentReconciliationService).runCycle();
      expect(
        (await context.db.order.findUniqueOrThrow({ where: { id: order.id } }))
          .status,
      ).toBe("PAID");
      expect(
        (
          await context.db.payment.findUniqueOrThrow({
            where: { id: payment.paymentId },
          })
        ).settlementSource,
      ).toBe("QUERY");
    } finally {
      query.mockRestore();
    }
  });

  it("cancels an expired unpaid order without stock deduction", async () => {
    const user = await customer(context);
    await cart(context, user.authorization);
    const order = (
      await context.http
        .post("/orders")
        .set("Authorization", user.authorization)
        .send({})
        .expect(201)
    ).body;
    await context.db.order.update({
      where: { id: order.id },
      data: { expiresAt: new Date(0) },
    });
    await context.http
      .post(`/orders/${order.id}/payments`)
      .set("Authorization", user.authorization)
      .send({})
      .expect(409);
    await context.app.get(PaymentReconciliationService).runCycle();
    expect(
      (await context.db.order.findUniqueOrThrow({ where: { id: order.id } }))
        .status,
    ).toBe("CANCELLED");
  });

  it("restores stock and compensates points only once on repeated paid cancellation", async () => {
    const { user, order, payment } = await orderAndPayment(context);
    const stock = await context.db.ingredient.findMany({
      orderBy: { id: "asc" },
      select: { id: true, quantityOnHand: true },
    });
    await context.http
      .get(`/payments/vnpay/ipn?${signedIpn(payment)}`)
      .expect(200);
    await context.http
      .post(`/orders/${order.id}/cancel`)
      .set("Authorization", user.authorization)
      .send({})
      .expect(201);
    const ledger = await context.db.loyaltyTransaction.findMany({
      where: { orderId: order.id },
      orderBy: { id: "asc" },
    });
    expect(ledger.length).toBeGreaterThan(1);
    await context.http
      .post(`/orders/${order.id}/cancel`)
      .set("Authorization", user.authorization)
      .send({})
      .expect(201);
    expect(
      await context.db.loyaltyTransaction.findMany({
        where: { orderId: order.id },
        orderBy: { id: "asc" },
      }),
    ).toEqual(ledger);
    expect(
      await context.db.ingredient.findMany({
        orderBy: { id: "asc" },
        select: { id: true, quantityOnHand: true },
      }),
    ).toEqual(stock);
  });

  it("keeps CANCELLED on late success and compensates once", async () => {
    const { user, order, payment } = await orderAndPayment(context);
    await context.http.get(
      `/payments/vnpay/ipn?${signedIpn(payment, { vnp_ResponseCode: "24", vnp_TransactionStatus: "02" })}`,
    );
    await context.http
      .post(`/orders/${order.id}/cancel`)
      .set("Authorization", user.authorization)
      .send({})
      .expect(201);
    await context.http.get(`/payments/vnpay/ipn?${signedIpn(payment)}`);
    const ledger = await context.db.loyaltyTransaction.count({
      where: { orderId: order.id },
    });
    expect(ledger).toBeGreaterThan(0);
    await context.http.get(`/payments/vnpay/ipn?${signedIpn(payment)}`);
    expect(
      (await context.db.order.findUniqueOrThrow({ where: { id: order.id } }))
        .status,
    ).toBe("CANCELLED");
    expect(
      await context.db.loyaltyTransaction.count({
        where: { orderId: order.id },
      }),
    ).toBe(ledger);
    expect(
      await context.db.orderIngredientUsage.count({
        where: { orderItem: { orderId: order.id } },
      }),
    ).toBe(0);
  });

  it("serializes concurrent duplicate IPNs on PostgreSQL", async () => {
    const { order, payment } = await orderAndPayment(context);
    const responses = await Promise.all(Array.from({ length: 4 }, () =>
      context.http.get(`/payments/vnpay/ipn?${signedIpn(payment)}`).expect(200)));
    expect(responses.map(response => response.body.RspCode).sort()).toEqual(['00', '02', '02', '02']);
    expect(await context.db.loyaltyTransaction.count({ where: { orderId: order.id, type: 'EARN' } })).toBe(1);
  });

  it("returns redeemed points and compensates verified money once on cancellation", async () => {
    const user = await customer(context);
    await context.db.user.update({ where: { id: user.user.id }, data: { pointsBalance: 100 } });
    await cart(context, user.authorization);
    const order = (await context.http.post('/orders').set('Authorization', user.authorization).send({ pointsRedeemed: 50 }).expect(201)).body;
    expect(order.vnpayPayableAmount).toBe(37000);
    const payment = (await context.http.post(`/orders/${order.id}/payments`).set('Authorization', user.authorization).send({}).expect(201)).body;
    await context.http.get(`/payments/vnpay/ipn?${signedIpn(payment)}`).expect(200);
    for (let attempt = 0; attempt < 2; attempt++) {
      await context.http.post(`/orders/${order.id}/cancel`).set('Authorization', user.authorization).send({}).expect(201);
    }
    for (const type of ['RETURN_REDEEMED', 'REVERSE_EARNED', 'VNPAY_COMPENSATION'] as const) {
      expect(await context.db.loyaltyTransaction.count({ where: { orderId: order.id, type } })).toBe(1);
    }
    expect((await context.db.user.findUniqueOrThrow({ where: { id: user.user.id } })).pointsBalance).toBe(470);
  });

  it("records PAYMENT_EXCEPTION and no partial deduction when stock disappears before IPN", async () => {
    const { order, payment } = await orderAndPayment(context);
    const ingredient = await context.db.ingredient.findUniqueOrThrow({
      where: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" },
    });
    await context.db.ingredient.update({
      where: { id: ingredient.id },
      data: { quantityOnHand: 0 },
    });
    try {
      await context.http
        .get(`/payments/vnpay/ipn?${signedIpn(payment)}`)
        .expect(200);
      expect(
        (await context.db.order.findUniqueOrThrow({ where: { id: order.id } }))
          .status,
      ).toBe("PAYMENT_EXCEPTION");
      expect(
        (
          await context.db.payment.findUniqueOrThrow({
            where: { id: payment.paymentId },
          })
        ).status,
      ).toBe("SUCCEEDED");
      expect(
        await context.db.orderIngredientUsage.count({
          where: { orderItem: { orderId: order.id } },
        }),
      ).toBe(0);
      expect(
        await context.db.loyaltyTransaction.count({
          where: { orderId: order.id, type: "EARN" },
        }),
      ).toBe(0);
    } finally {
      await context.db.ingredient.update({
        where: { id: ingredient.id },
        data: { quantityOnHand: ingredient.quantityOnHand },
      });
    }
  });
});
