import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { SignJWT } from "jose";
import { createHmac } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OrderModule } from "../order/order.module.js";
import { OrderService } from "../order/order.service.js";
import { PAYMENT_COMPENSATION_PORT } from "../order/payment-compensation.port.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { PaymentReconciliationService } from "../scheduler/payment-reconciliation.service.js";
import { SchedulerModule } from "../scheduler/scheduler.module.js";
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from "../vnpay/vnpay.types.js";
import { PAYMENT_REPOSITORY_PORT } from "./payment.contracts.js";
import { PaymentModule } from "./payment.module.js";
import { InMemoryPaymentRepository } from "./prisma-payment.store.js";

const secret = "integration-test-only-vnpay-sandbox-secret";
const jwtSecret = "integration-test-jwt-secret-at-least-32-chars";
const sign = (data: string) =>
  createHmac("sha512", secret).update(data, "utf8").digest("hex");

async function signAccessToken(user: {
  id: string;
  email: string;
  role: "CUSTOMER" | "STAFF" | "MANAGER";
}): Promise<string> {
  return new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(jwtSecret));
}

function buildSignedIpnQuery(
  params: {
    transactionRef: string;
    amountVnd: number;
    responseCode?: string;
    transactionStatus?: string;
    transactionNo?: string;
    tmnCode?: string;
  },
  corruptSignature = false,
): string {
  const fields: Record<string, string> = {
    vnp_TmnCode: params.tmnCode ?? "TESTCODE",
    vnp_TxnRef: params.transactionRef,
    vnp_Amount: String(params.amountVnd * 100),
    vnp_ResponseCode: params.responseCode ?? "00",
    vnp_TransactionStatus: params.transactionStatus ?? "00",
    vnp_TransactionNo: params.transactionNo ?? "12345678",
    vnp_PayDate: "20261115171500",
    vnp_BankCode: "NCB",
  };
  const encoded = Object.keys(fields)
    .sort()
    .map(
      (k) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(fields[k]).replace(/%20/g, "+")}`,
    )
    .join("&");
  const hash = corruptSignature ? "0".repeat(128) : sign(encoded);
  return `${encoded}&vnp_SecureHash=${hash}`;
}

describe("Payment & VNPay Sandbox Integration Tests (15 scenarios)", () => {
  const originalEnv = { ...process.env };
  let app: INestApplication;
  let repository: InMemoryPaymentRepository;
  let reconciliation: PaymentReconciliationService;
  let gateway: PaymentGateway;

  const userId = "11111111-1111-4111-8111-111111111111";
  const otherUserId = "22222222-2222-4222-8222-222222222222";
  const staffUserId = "33333333-3333-4333-8333-333333333333";
  const orderId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  let customerToken: string;
  let otherCustomerToken: string;
  let staffToken: string;

  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = jwtSecret;
    process.env.LOYALTY_EARN_POINTS_PER_VND = "0.001";
    process.env.LOYALTY_EARN_ROUNDING = "FLOOR";
    process.env.VNP_TMN_CODE = "TESTCODE";
    process.env.VNP_HASH_SECRET = secret;
    process.env.VNP_PAY_URL =
      "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    process.env.VNP_API_URL =
      "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction";
    process.env.VNP_RETURN_URL = "http://localhost:3000/payment/return";

    repository = new InMemoryPaymentRepository();
    const moduleRef = await Test.createTestingModule({
      imports: [PaymentModule, SchedulerModule, OrderModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(PAYMENT_REPOSITORY_PORT)
      .useValue(repository)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    reconciliation = app.get(PaymentReconciliationService);
    gateway = app.get(PAYMENT_GATEWAY);
    customerToken = await signAccessToken({
      id: userId,
      email: "customer1@brewlite.local",
      role: "CUSTOMER",
    });
    otherCustomerToken = await signAccessToken({
      id: otherUserId,
      email: "customer2@brewlite.local",
      role: "CUSTOMER",
    });
    staffToken = await signAccessToken({
      id: staffUserId,
      email: "staff@brewlite.local",
      role: "STAFF",
    });

    const now = new Date();
    repository.seedOrder(
      {
        id: orderId,
        orderCode: "BL-1001",
        userId,
        status: "PENDING",
        subtotal: 45000,
        discountAmount: 0,
        totalAmount: 45000,
        pointsRedeemed: 50,
        pointsDiscountAmount: 5000,
        vnpayPayableAmount: 40000,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 15 * 60_000),
      },
      { initialPointsBalance: 200 },
    );
  });

  afterEach(async () => {
    await app?.close();
    process.env = { ...originalEnv };
  });

  it("wires OrderModule and PAYMENT_COMPENSATION_PORT together in Nest DI", () => {
    expect(app.get(OrderService)).toBeDefined();
    expect(app.get(PAYMENT_COMPENSATION_PORT)).toBeDefined();
  });

  it("covers creation, ownership, RBAC, idempotency replay, concurrent attempt protection and client amount rejection (Scenarios 1, 2, 4, 5)", async () => {
    const server = app.getHttpServer();

    // Không có header xác thực -> 401
    await request(server).post("/payments").send({ orderId }).expect(401);

    // STAFF không được gọi endpoint thanh toán của CUSTOMER -> 403
    await request(server)
      .post("/payments")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ orderId })
      .expect(403);

    // User khác truy cập đơn -> 404
    await request(server)
      .post("/payments")
      .set("Authorization", `Bearer ${otherCustomerToken}`)
      .send({ orderId })
      .expect(404);

    // Client cố tình truyền amount -> 400 (ValidationPipe forbidNonWhitelisted)
    await request(server)
      .post(`/orders/${orderId}/payments`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ amount: 1000 })
      .expect(400);

    // Tạo attempt hợp lệ
    const first = await request(server)
      .post("/payments")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", "key-001")
      .send({ orderId })
      .expect(201);

    expect(first.body.amount).toBe(40000);
    expect(first.body.status).toBe("PENDING");
    expect(first.body.paymentUrl).toContain("sandbox.vnpayment.vn");

    // Gửi lặp cùng Idempotency-Key -> trả cùng paymentId
    const replay = await request(server)
      .post("/payments")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", "key-001")
      .send({ orderId })
      .expect(201);
    expect(replay.body.paymentId).toBe(first.body.paymentId);

    // Gửi một key khác khi attempt trước vẫn đang PENDING -> bị chặn 409 (không tạo attempt cạnh tranh)
    await request(server)
      .post("/payments")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", "key-002")
      .send({ orderId })
      .expect(409);
  });

  it("handles valid IPN, invalid signature/amount/ref, duplicate IPN and Return URL non-authority (Scenarios 6, 7, 8)", async () => {
    const server = app.getHttpServer();

    const created = await request(server)
      .post("/payments")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", "key-ipn-1")
      .send({ orderId })
      .expect(201);

    const txnRef = created.body.transactionRef as string;

    // IPN sai chữ ký -> RspCode 97
    const badSig = await request(server)
      .get(
        `/payments/vnpay/ipn?${buildSignedIpnQuery({ transactionRef: txnRef, amountVnd: 40000 }, true)}`,
      )
      .expect(200);
    expect(badSig.body.RspCode).toBe("97");

    // IPN sai số tiền -> RspCode 04
    const badAmount = await request(server)
      .get(
        `/payments/vnpay/ipn?${buildSignedIpnQuery({ transactionRef: txnRef, amountVnd: 10000 })}`,
      )
      .expect(200);
    expect(badAmount.body.RspCode).toBe("04");

    // IPN sai TxnRef -> RspCode 01
    const badRef = await request(server)
      .get(
        `/payments/vnpay/ipn?${buildSignedIpnQuery({ transactionRef: "UNKNOWNREF", amountVnd: 40000 })}`,
      )
      .expect(200);
    expect(badRef.body.RspCode).toBe("01");

    // Return URL không làm thay đổi trạng thái đơn/thanh toán
    await request(server)
      .get(
        `/payments/vnpay/return?orderId=${orderId}&${buildSignedIpnQuery({ transactionRef: txnRef, amountVnd: 40000 })}`,
      )
      .expect(200);
    expect(repository.getOrder(orderId)?.status).toBe("PENDING");

    // IPN hợp lệ gửi 3 lần đồng thời -> chỉ 1 lần 00, 2 lần 02
    const validQuery = buildSignedIpnQuery({
      transactionRef: txnRef,
      amountVnd: 40000,
    });
    const [r1, r2, r3] = await Promise.all([
      request(server).get(`/payments/vnpay/ipn?${validQuery}`),
      request(server).get(`/payments/vnpay/ipn?${validQuery}`),
      request(server).get(`/payments/vnpay/ipn?${validQuery}`),
    ]);
    expect(
      [r1.body.RspCode, r2.body.RspCode, r3.body.RspCode].sort((a: string, b: string) =>
        a.localeCompare(b),
      ),
    ).toEqual([
      "00",
      "02",
      "02",
    ]);

    expect(repository.getOrder(orderId)?.status).toBe("PAID");
    expect(repository.isOrderDeducted(orderId)).toBe(true);
    // Cộng điểm EARN 1 lần (40.000đ -> 40 điểm): 200 + 40 = 240
    expect(repository.getUserPointsBalance(userId)).toBe(240);
  });

  it("allows retry after verified FAILED attempt and reconciles missing IPN via QueryDR (Scenarios 9, 10, 12)", async () => {
    const server = app.getHttpServer();

    const first = await request(server)
      .post("/payments")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", "key-fail-then-retry")
      .send({ orderId })
      .expect(201);

    // IPN báo FAILED (mã 24 - khách hủy giao dịch)
    const failedQuery = buildSignedIpnQuery({
      transactionRef: first.body.transactionRef,
      amountVnd: 40000,
      responseCode: "24",
      transactionStatus: "02",
    });
    const failedIpn = await request(server)
      .get(`/payments/vnpay/ipn?${failedQuery}`)
      .expect(200);
    expect(failedIpn.body.RspCode).toBe("00");
    expect(repository.getOrder(orderId)?.status).toBe("PAYMENT_FAILED");

    // Kiểm tra trạng thái cho phép retry
    const statusRes = await request(server)
      .get(`/orders/${orderId}/payment-status`)
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);
    expect(statusRes.body.canRetry).toBe(true);

    // Tạo attempt thứ 2 với key mới -> tạo mã giao dịch mới
    const second = await request(server)
      .post("/payments")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", "key-retry-2")
      .send({ orderId })
      .expect(201);
    expect(second.body.transactionRef).not.toBe(first.body.transactionRef);

    // Giả lập mất IPN, đối soát bằng QueryDR khi tới hạn kiểm tra
    let queryCalls = 0;
    gateway.queryTransaction = async (req) => {
      queryCalls++;
      return {
        transactionRef: req.transactionRef,
        amount: req.amount,
        status: "SUCCEEDED",
        responseCode: "00",
        transactionStatus: "00",
        providerTransactionNo: "55667788",
        bankCode: "NCB",
        payDate: "20261115172000",
      };
    };

    const futureNow = new Date(Date.now() + 6 * 60_000);
    await Promise.all([
      reconciliation.runCycle(futureNow),
      reconciliation.runCycle(futureNow),
    ]);
    expect(queryCalls).toBe(1);
    expect(repository.getOrder(orderId)?.status).toBe("PAID");
    expect(repository.getPayment(second.body.paymentId)?.status).toBe(
      "SUCCEEDED",
    );
  });

  it("handles late VNPay success after Order was CANCELLED without reopening order and grants compensation points once (Scenario 10 / BR-11)", async () => {
    const server = app.getHttpServer();

    const attempt = await request(server)
      .post("/payments")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", "key-late-success")
      .send({ orderId })
      .expect(201);

    // Đơn bị hủy trước khi IPN đến
    await repository.runInTransaction(async (tx) => {
      await tx.updateOrderStatus(orderId, "CANCELLED");
    });

    // Không cho tạo Payment mới trên đơn đã CANCELLED (Scenario 3)
    await request(server)
      .post("/payments")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", "key-after-cancel")
      .send({ orderId })
      .expect(409);

    // IPN thành công đến muộn
    const lateQuery = buildSignedIpnQuery({
      transactionRef: attempt.body.transactionRef,
      amountVnd: 40000,
    });
    const res = await request(server)
      .get(`/payments/vnpay/ipn?${lateQuery}`)
      .expect(200);
    expect(res.body.RspCode).toBe("00");

    // Đơn giữ nguyên CANCELLED, không trừ kho, nhưng được bù 400 điểm (40.000 / 100)
    expect(repository.getOrder(orderId)?.status).toBe("CANCELLED");
    expect(repository.isOrderDeducted(orderId)).toBe(false);
    expect(repository.getUserPointsBalance(userId)).toBe(200 + 400);
  });

  it("rolls back entire settlement transaction if an unexpected write error occurs (Scenario 15)", async () => {
    const server = app.getHttpServer();

    const attempt = await request(server)
      .post("/payments")
      .set("Authorization", `Bearer ${customerToken}`)
      .set("Idempotency-Key", "key-rollback")
      .send({ orderId })
      .expect(201);

    const originalRun = repository.runInTransaction.bind(repository);
    repository.runInTransaction = async (work) =>
      originalRun(async (tx) => {
        const wrappedTx = {
          ...tx,
          recordLoyaltyTransaction: async () => {
            throw new Error("SIMULATED_DB_FAILURE");
          },
        };
        return work(wrappedTx);
      });

    const query = buildSignedIpnQuery({
      transactionRef: attempt.body.transactionRef,
      amountVnd: 40000,
    });
    const res = await request(server)
      .get(`/payments/vnpay/ipn?${query}`)
      .expect(200);
    expect(res.body.RspCode).toBe("99");

    // Cả Order, Payment và tồn kho đều được rollback về trạng thái ban đầu
    expect(repository.getOrder(orderId)?.status).toBe("PENDING");
    expect(repository.getPayment(attempt.body.paymentId)?.status).toBe(
      "PENDING",
    );
    expect(repository.isOrderDeducted(orderId)).toBe(false);
  });
});
