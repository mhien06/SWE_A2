import { ConflictException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import type { PaymentGateway } from "../vnpay/vnpay.types.js";
import { PaymentCompensationService } from "./payment-compensation.service.js";
import { PaymentSettlementService } from "./payment-settlement.service.js";
import { PaymentService } from "./payment.service.js";
import { computeVnpayCompensationPoints } from "./payment.types.js";
import { InMemoryPaymentRepository } from "./prisma-payment.store.js";

describe("PaymentService, Settlement & Compensation unit tests", () => {
  let repository: InMemoryPaymentRepository;
  let gateway: PaymentGateway;
  let compensation: PaymentCompensationService;
  let settlement: PaymentSettlementService;
  let paymentService: PaymentService;

  const userId = "user-customer-1";
  const orderId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    repository = new InMemoryPaymentRepository();
    gateway = {
      createPaymentUrl: (req) =>
        `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=${req.transactionRef}&vnp_Amount=${req.amount * 100}`,
      verifyNotification: () => null,
      verifyReturnUrl: () => ({
        validSignature: true,
        orderId,
        transactionRef: "TX1",
        responseCode: "00",
        transactionStatus: "00",
      }),
      queryTransaction: async () => null,
    };
    compensation = new PaymentCompensationService();
    settlement = new PaymentSettlementService(repository, compensation);
    paymentService = new PaymentService(repository, gateway);

    const now = new Date();
    repository.seedOrder(
      {
        id: orderId,
        orderCode: "BL-0001",
        userId,
        status: "PENDING",
        subtotal: 35050,
        discountAmount: 0,
        totalAmount: 35050,
        pointsRedeemed: 60,
        pointsDiscountAmount: 6000,
        vnpayPayableAmount: 29050,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 15 * 60_000),
      },
      { initialPointsBalance: 100 },
    );
  });

  it("computes BrewLite compensation points with ceil(VND / 100)", () => {
    expect(computeVnpayCompensationPoints(29050)).toBe(291);
    expect(computeVnpayCompensationPoints(29000)).toBe(290);
    expect(computeVnpayCompensationPoints(0)).toBe(0);
    expect(computeVnpayCompensationPoints(-500)).toBe(0);
  });

  it("creates an attempt with 5-minute TTL capped by Order 15-minute expiry and replays same idempotencyKey even after Order is PAID", async () => {
    const attempt = await paymentService.createAttempt({
      userId,
      orderId,
      idempotencyKey: "idem-key-1",
    });

    expect(attempt.amount).toBe(29050);
    expect(attempt.status).toBe("PENDING");
    expect(attempt.paymentUrl).toContain(attempt.transactionRef);

    const ttlMs =
      new Date(attempt.expiresAt).getTime() -
      new Date(attempt.createdAt).getTime();
    expect(ttlMs).toBeLessThanOrEqual(5 * 60_000);

    // Chuyển sang PAID qua IPN
    const settled = await settlement.settle(
      {
        transactionRef: attempt.transactionRef,
        amount: 29050,
        status: "SUCCEEDED",
        responseCode: "00",
        transactionStatus: "00",
        providerTransactionNo: "998877",
        bankCode: "NCB",
        payDate: "20261115170500",
      },
      "IPN",
    );
    expect(settled).toBe("ACCEPTED");
    expect(repository.getOrder(orderId)?.status).toBe("PAID");

    // Gửi lại đúng key cũ sau khi đơn đã PAID vẫn trả về kết quả gắn với key đó (Rule 3)
    const replayed = await paymentService.createAttempt({
      userId,
      orderId,
      idempotencyKey: "idem-key-1",
    });
    expect(replayed.paymentId).toBe(attempt.paymentId);
    expect(replayed.status).toBe("SUCCEEDED");
    expect(replayed.paymentUrl).toBeNull();
  });

  it("rejects same Idempotency-Key with different payload (409) and blocks unauthorized users (404)", async () => {
    const secondOrderId = "22222222-2222-4222-8222-222222222222";
    const now = new Date();
    repository.seedOrder({
      id: secondOrderId,
      orderCode: "BL-0002",
      userId,
      status: "PENDING",
      subtotal: 40000,
      discountAmount: 0,
      totalAmount: 40000,
      pointsRedeemed: 0,
      pointsDiscountAmount: 0,
      vnpayPayableAmount: 40000,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 15 * 60_000),
    });

    await paymentService.createAttempt({
      userId,
      orderId,
      idempotencyKey: "shared-key",
    });

    await expect(
      paymentService.createAttempt({
        userId,
        orderId: secondOrderId,
        idempotencyKey: "shared-key",
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    await expect(
      paymentService.createAttempt({
        userId: "other-user",
        orderId,
        idempotencyKey: "other-key",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("handles insufficient ingredients (BR-12): Payment SUCCEEDED, Order PAYMENT_EXCEPTION, returns REDEEM and grants VNPAY_COMPENSATION once", async () => {
    repository.setOrderInsufficientIngredients(orderId, true);

    const attempt = await paymentService.createAttempt({
      userId,
      orderId,
      idempotencyKey: "idem-shortage",
    });

    const firstSettle = await settlement.settle(
      {
        transactionRef: attempt.transactionRef,
        amount: 29050,
        status: "SUCCEEDED",
        responseCode: "00",
        transactionStatus: "00",
        providerTransactionNo: "112233",
        bankCode: "NCB",
        payDate: "20261115171000",
      },
      "IPN",
    );
    expect(firstSettle).toBe("ACCEPTED");

    // Gửi lặp IPN lần 2 không được cấp điểm bù lần 2
    const duplicateSettle = await settlement.settle(
      {
        transactionRef: attempt.transactionRef,
        amount: 29050,
        status: "SUCCEEDED",
        responseCode: "00",
        transactionStatus: "00",
        providerTransactionNo: "112233",
        bankCode: "NCB",
        payDate: "20261115171000",
      },
      "IPN",
    );
    expect(duplicateSettle).toBe("DUPLICATE");

    expect(repository.getOrder(orderId)?.status).toBe("PAYMENT_EXCEPTION");
    expect(repository.getPayment(attempt.paymentId)?.status).toBe("SUCCEEDED");
    expect(repository.isOrderDeducted(orderId)).toBe(false);

    // Điểm ban đầu 100 + hoàn 60 điểm REDEEM + bù 291 điểm (ceil(29050/100)) = 451
    expect(repository.getUserPointsBalance(userId)).toBe(451);
    const ledger = repository.listLoyaltyTransactions();
    expect(ledger.map((l) => l.type)).toEqual([
      "RETURN_REDEEMED",
      "VNPAY_COMPENSATION",
    ]);
  });

  it("respects VNPayRefundRecord exclusion rules (FR-20): blocks compensation when refund SUCCEEDED or PENDING/UNKNOWN", async () => {
    const attempt = await paymentService.createAttempt({
      userId,
      orderId,
      idempotencyKey: "idem-refund-check",
    });

    // Giả lập đơn đã CANCELLED và đã có bản ghi refund VNPay cũ SUCCEEDED
    await repository.runInTransaction(async (tx) => {
      await tx.updateOrderStatus(orderId, "CANCELLED");
    });
    repository.seedRefundRecord({
      id: "refund-1",
      paymentId: attempt.paymentId,
      amount: 29050,
      status: "SUCCEEDED",
      providerRefundRef: "RF001",
      requestedAt: new Date(),
      resolvedAt: new Date(),
    });

    const settled = await settlement.settle(
      {
        transactionRef: attempt.transactionRef,
        amount: 29050,
        status: "SUCCEEDED",
        responseCode: "00",
        transactionStatus: "00",
        providerTransactionNo: "778899",
        bankCode: "NCB",
        payDate: "20261115171200",
      },
      "QUERY",
    );
    expect(settled).toBe("ACCEPTED");
    expect(repository.getOrder(orderId)?.status).toBe("CANCELLED");
    // Không cấp VNPAY_COMPENSATION vì đã có refund SUCCEEDED
    expect(repository.listLoyaltyTransactions()).toHaveLength(0);
    expect(repository.getUserPointsBalance(userId)).toBe(100);
  });
});
