import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from "../vnpay/vnpay.types.js";
import {
  PAYMENT_REPOSITORY_PORT,
  type PaymentRepositoryPort,
} from "./payment.contracts.js";
import {
  isUnresolvedPaymentStatus,
  type OrderSnapshotForPayment,
  type PaymentRecord,
} from "./payment.types.js";

function computePayloadHash(userId: string, orderId: string): string {
  return createHash("sha256")
    .update(JSON.stringify({ userId, orderId }))
    .digest("hex");
}

function getAttemptTtlMs(): number {
  const configured = Number(process.env.PAYMENT_ATTEMPT_TTL_MINUTES ?? "5");
  const minutes =
    Number.isFinite(configured) && configured > 0
      ? Math.min(configured, 15)
      : 5;
  return minutes * 60 * 1000;
}

@Injectable()
export class PaymentService {
  constructor(
    @Inject(PAYMENT_REPOSITORY_PORT)
    private readonly repository: PaymentRepositoryPort,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
  ) {}

  async createAttempt(input: {
    userId: string;
    orderId: string;
    idempotencyKey?: string;
    ipAddress?: string;
  }) {
    const orderId = input.orderId?.trim();
    if (!orderId) {
      throw new BadRequestException({
        code: "INVALID_ORDER_ID",
        message: "orderId is required.",
      });
    }

    const idempotencyKey = (input.idempotencyKey ?? randomUUID()).trim();
    if (!idempotencyKey || idempotencyKey.length > 128) {
      throw new BadRequestException({
        code: "INVALID_IDEMPOTENCY_KEY",
        message: "Idempotency-Key must be between 1 and 128 characters.",
      });
    }

    const payloadHash = computePayloadHash(input.userId, orderId);
    const ipAddress = input.ipAddress ?? "127.0.0.1";

    return this.repository.runInTransaction(async (tx) => {
      // Quy tắc 1, 2, 3 (Phase 3.2): Kiểm tra Idempotency-Key TRƯỚC khi kiểm tra trạng thái Order
      // để replay key cũ vẫn trả lại đúng kết quả ngay cả khi Order đã chuyển PAID.
      const existingByKey =
        await tx.findPaymentByIdempotencyKey(idempotencyKey);
      if (existingByKey) {
        if (existingByKey.payloadHash !== payloadHash) {
          throw new ConflictException({
            code: "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH",
            message:
              "Idempotency-Key has already been used with a different request payload.",
          });
        }
        const existingOrder = await tx.lockOrderById(existingByKey.orderId);
        if (!existingOrder || existingOrder.userId !== input.userId) {
          throw new NotFoundException({
            code: "ORDER_NOT_FOUND",
            message: "Order not found.",
          });
        }
        return this.formatAttemptResponse(existingByKey, existingOrder);
      }

      const order = await tx.lockOrderById(orderId);
      if (!order || order.userId !== input.userId) {
        throw new NotFoundException({
          code: "ORDER_NOT_FOUND",
          message: "Order not found.",
        });
      }

      const attempts = await tx.listOrderPayments(orderId);
      const unresolved = attempts.find((a) =>
        isUnresolvedPaymentStatus(a.status),
      );
      if (unresolved) {
        throw new ConflictException({
          code: "PAYMENT_ATTEMPT_IN_PROGRESS",
          message:
            "Đơn hàng đang có giao dịch chờ xác minh (PENDING/UNKNOWN). Vui lòng chờ đối soát trước khi tạo lượt thanh toán mới.",
        });
      }

      if (
        order.status !== "PENDING" &&
        order.status !== "PAYMENT_FAILED"
      ) {
        throw new ConflictException({
          code: "ORDER_NOT_PAYABLE",
          message: `Order in status ${order.status} cannot initiate a new payment attempt.`,
        });
      }

      const now = new Date();
      if (order.expiresAt.getTime() <= now.getTime()) {
        throw new ConflictException({
          code: "ORDER_EXPIRED",
          message: "Đơn hàng đã hết thời hạn thanh toán 15 phút.",
        });
      }

      if (
        !Number.isSafeInteger(order.vnpayPayableAmount) ||
        order.vnpayPayableAmount <= 0
      ) {
        throw new ConflictException({
          code: "INVALID_PAYABLE_AMOUNT",
          message: "Số tiền thanh toán VNPay không hợp lệ.",
        });
      }

      // Hạn mỗi attempt tối đa 5 phút và không bao giờ vượt quá hạn 15 phút của Order (ADR-007 / Phase 4.2)
      const expiresAt = new Date(
        Math.min(
          order.expiresAt.getTime(),
          now.getTime() + getAttemptTtlMs(),
        ),
      );
      const transactionRef = randomUUID().replace(/-/g, "");
      const paymentUrl = this.gateway.createPaymentUrl({
        orderId: order.id,
        transactionRef,
        amount: order.vnpayPayableAmount,
        ipAddress,
        createdAt: now,
        expiresAt,
      });

      const created = await tx.createPaymentAttempt({
        orderId: order.id,
        provider: "VNPAY_SANDBOX",
        status: "PENDING",
        amount: order.vnpayPayableAmount,
        transactionRef,
        idempotencyKey,
        payloadHash,
        paymentUrl,
        providerTransactionNo: null,
        responseCode: null,
        transactionStatus: null,
        bankCode: null,
        payDate: null,
        createdAt: now,
        expiresAt,
        verifiedAt: null,
        nextQueryAt: expiresAt,
        queryAttempts: 0,
        reviewRequired: false,
        settlementSource: null,
      });

      await tx.recordPaymentEvent({
        paymentId: created.id,
        orderId: order.id,
        eventType: "ATTEMPT_CREATED",
        source: "API",
        details: {
          transactionRef: created.transactionRef,
          amount: created.amount,
          expiresAt: created.expiresAt.toISOString(),
        },
      });

      return this.formatAttemptResponse(created, order);
    });
  }

  async getPaymentById(userId: string, paymentId: string) {
    const found = await this.repository.findPaymentForUser(userId, paymentId);
    if (!found) {
      throw new NotFoundException({
        code: "PAYMENT_NOT_FOUND",
        message: "Payment not found.",
      });
    }
    return this.formatAttemptResponse(found.payment, found.order);
  }

  async getOrderPaymentStatus(userId: string, orderId: string) {
    const snapshot = await this.repository.findOrderWithLatestPayment(
      userId,
      orderId,
    );
    if (!snapshot) {
      throw new NotFoundException({
        code: "ORDER_NOT_FOUND",
        message: "Order not found.",
      });
    }

    const { order, latestPayment, hasReviewRequired } = snapshot;
    const now = Date.now();
    const orderExpired = order.expiresAt.getTime() <= now;
    const orderPayable =
      (order.status === "PENDING" || order.status === "PAYMENT_FAILED") &&
      !orderExpired &&
      !hasReviewRequired &&
      order.vnpayPayableAmount > 0;

    const canPay = orderPayable && !latestPayment;
    const canRetry =
      orderPayable &&
      Boolean(
        latestPayment &&
          (latestPayment.status === "FAILED" ||
            latestPayment.status === "EXPIRED"),
      );

    return {
      orderId: order.id,
      orderCode: order.orderCode,
      orderStatus: order.status,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      pointsRedeemed: order.pointsRedeemed,
      pointsDiscountAmount: order.pointsDiscountAmount,
      vnpayPayableAmount: order.vnpayPayableAmount,
      orderExpiresAt: order.expiresAt.toISOString(),
      items: order.items ?? [],
      payment: latestPayment
        ? this.formatAttemptResponse(latestPayment, order)
        : null,
      canPay,
      canRetry,
      needsReview:
        hasReviewRequired || order.status === "PAYMENT_EXCEPTION",
    };
  }

  private formatAttemptResponse(
    payment: PaymentRecord,
    order: OrderSnapshotForPayment,
  ) {
    const now = Date.now();
    const attemptExpired = payment.expiresAt.getTime() <= now;
    const orderExpired = order.expiresAt.getTime() <= now;
    const awaitingVerification =
      isUnresolvedPaymentStatus(payment.status) &&
      (attemptExpired || orderExpired || payment.status === "UNKNOWN");

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      orderStatus: order.status,
      provider: payment.provider,
      transactionRef: payment.transactionRef,
      idempotencyKey: payment.idempotencyKey,
      amount: payment.amount,
      status: payment.status,
      createdAt: payment.createdAt.toISOString(),
      expiresAt: payment.expiresAt.toISOString(),
      orderExpiresAt: order.expiresAt.toISOString(),
      verifiedAt: payment.verifiedAt ? payment.verifiedAt.toISOString() : null,
      awaitingVerification,
      paymentUrl:
        payment.status === "PENDING" &&
        !attemptExpired &&
        !orderExpired &&
        !payment.reviewRequired
          ? payment.paymentUrl
          : null,
      needsReview:
        payment.reviewRequired || order.status === "PAYMENT_EXCEPTION",
    };
  }
}
