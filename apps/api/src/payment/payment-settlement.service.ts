import { Inject, Injectable } from "@nestjs/common";
import type { PaymentEvidence } from "../vnpay/vnpay.types.js";
import { PaymentCompensationService } from "./payment-compensation.service.js";
import {
  PAYMENT_REPOSITORY_PORT,
  type PaymentRepositoryPort,
} from "./payment.contracts.js";
import { isUnresolvedPaymentStatus } from "./payment.types.js";

export type SettlementResult =
  | "ACCEPTED"
  | "DUPLICATE"
  | "NOT_FOUND"
  | "INVALID_AMOUNT";

@Injectable()
export class PaymentSettlementService {
  constructor(
    @Inject(PAYMENT_REPOSITORY_PORT)
    private readonly repository: PaymentRepositoryPort,
    private readonly compensation: PaymentCompensationService,
  ) {}

  /**
   * Giao dịch xử lý kết quả thanh toán (dùng chung cho cả IPN và QueryDR theo ADR-006):
   * - Khóa Order -> Payment theo thứ tự cố định.
   * - Kiểm tra khớp số tiền (`Payment.amount === evidence.amount === Order.vnpayPayableAmount`).
   * - Xử lý đầy đủ các nhánh:
   *   1) Lặp (DUPLICATE) & thanh toán thành công đến sau khi attempt đã kết thúc thất bại.
   *   2) FAILED / EXPIRED -> cập nhật Payment; chỉ chuyển Order sang PAYMENT_FAILED nếu Order còn PENDING.
   *   3) SUCCEEDED nhưng Order đã CANCELLED -> giữ nguyên CANCELLED, không trừ kho, không EARN, bù điểm 1 lần (BR-11, E08).
   *   4) SUCCEEDED nhưng thiếu nguyên liệu -> Payment SUCCEEDED, Order PAYMENT_EXCEPTION, không trừ kho, không EARN, hoàn REDEEM + bù điểm 1 lần (BR-12, E09).
   *   5) SUCCEEDED hợp lệ -> trừ nguyên liệu theo công thức, ghi OrderIngredientUsage, cộng điểm EARN trên số tiền thực trả, chuyển Order sang PAID (FR-10).
   */
  async settle(
    evidence: PaymentEvidence,
    source: "IPN" | "QUERY",
  ): Promise<SettlementResult> {
    return this.repository.runInTransaction(async (tx) => {
      const lookup = await tx.findPaymentByTransactionRef(
        evidence.transactionRef,
      );
      if (!lookup) {
        return "NOT_FOUND";
      }

      const order = await tx.lockOrderById(lookup.orderId);
      const payment = await tx.lockPaymentByTransactionRef(
        evidence.transactionRef,
      );
      if (!order || !payment) {
        return "NOT_FOUND";
      }

      if (
        payment.amount !== evidence.amount ||
        order.vnpayPayableAmount !== evidence.amount
      ) {
        return "INVALID_AMOUNT";
      }

      const now = new Date();

      if (!isUnresolvedPaymentStatus(payment.status)) {
        if (
          evidence.status === "SUCCEEDED" &&
          payment.status !== "SUCCEEDED"
        ) {
          await tx.updatePaymentSettlement(payment.id, {
            status: "SUCCEEDED",
            providerTransactionNo: evidence.providerTransactionNo,
            responseCode: evidence.responseCode,
            transactionStatus: evidence.transactionStatus,
            bankCode: evidence.bankCode,
            payDate: evidence.payDate,
            verifiedAt: now,
            settlementSource: source,
            reviewRequired: true,
          });
          await tx.recordPaymentEvent({
            paymentId: payment.id,
            orderId: order.id,
            eventType: "SUCCESS_AFTER_TERMINAL_FAILURE",
            source,
            details: {
              previousStatus: payment.status,
              orderStatus: order.status,
              transactionRef: evidence.transactionRef,
            },
          });
          await this.compensation.compensateVerifiedPayment(tx, {
            userId: order.userId,
            orderId: order.id,
            paymentId: payment.id,
            actualPaidVnd: payment.amount,
          });
        }
        return "DUPLICATE";
      }

      if (evidence.status === "UNKNOWN") {
        await tx.updatePaymentSettlement(payment.id, {
          status: "UNKNOWN",
          providerTransactionNo: evidence.providerTransactionNo || null,
          responseCode: evidence.responseCode,
          transactionStatus: evidence.transactionStatus,
          bankCode: evidence.bankCode || null,
          payDate: evidence.payDate || null,
          verifiedAt: null,
          settlementSource: source,
        });
        return "ACCEPTED";
      }

      if (evidence.status === "FAILED" || evidence.status === "EXPIRED") {
        await tx.updatePaymentSettlement(payment.id, {
          status: evidence.status,
          providerTransactionNo: evidence.providerTransactionNo || null,
          responseCode: evidence.responseCode,
          transactionStatus: evidence.transactionStatus,
          bankCode: evidence.bankCode || null,
          payDate: evidence.payDate || null,
          verifiedAt: now,
          settlementSource: source,
        });

        if (order.status === "PENDING" && evidence.status === "FAILED") {
          await tx.updateOrderStatus(order.id, "PAYMENT_FAILED");
        }

        await tx.recordPaymentEvent({
          paymentId: payment.id,
          orderId: order.id,
          eventType: source === "IPN" ? "IPN_SETTLED" : "QUERYDR_SETTLED",
          source,
          details: { status: evidence.status, orderStatus: order.status },
        });
        return "ACCEPTED";
      }

      // Từ đây: evidence.status === "SUCCEEDED"
      await tx.updatePaymentSettlement(payment.id, {
        status: "SUCCEEDED",
        providerTransactionNo: evidence.providerTransactionNo,
        responseCode: evidence.responseCode,
        transactionStatus: evidence.transactionStatus,
        bankCode: evidence.bankCode,
        payDate: evidence.payDate,
        verifiedAt: now,
        settlementSource: source,
      });

      // Nhánh 1: Thanh toán thành công đến muộn khi Order đã CANCELLED ( hoặc không còn ở trạng thái chờ thanh toán )
      if (order.status === "CANCELLED") {
        await tx.recordPaymentEvent({
          paymentId: payment.id,
          orderId: order.id,
          eventType: "LATE_SUCCESS_AFTER_CANCEL",
          source,
          details: {
            transactionRef: evidence.transactionRef,
            amount: payment.amount,
          },
        });
        await this.compensation.compensateVerifiedPayment(tx, {
          userId: order.userId,
          orderId: order.id,
          paymentId: payment.id,
          actualPaidVnd: payment.amount,
        });
        return "ACCEPTED";
      }

      if (order.status !== "PENDING" && order.status !== "PAYMENT_FAILED") {
        // Đơn đã PAID hoặc đang pha chế: không trừ kho lần 2
        return "DUPLICATE";
      }

      // Nhánh 2: Kiểm tra và trừ nguyên liệu có điều kiện
      const deduction = await tx.deductIngredientsForOrder(order.id);
      if (!deduction.sufficient) {
        await tx.updateOrderStatus(order.id, "PAYMENT_EXCEPTION");
        await tx.recordPaymentEvent({
          paymentId: payment.id,
          orderId: order.id,
          eventType: "INSUFFICIENT_INGREDIENTS",
          source,
          details: {
            transactionRef: evidence.transactionRef,
            amount: payment.amount,
          },
        });
        await this.compensation.returnRedeemedPointsIfAny(tx, {
          userId: order.userId,
          orderId: order.id,
          pointsRedeemed: order.pointsRedeemed,
          pointsDiscountAmount: order.pointsDiscountAmount,
        });
        await this.compensation.compensateVerifiedPayment(tx, {
          userId: order.userId,
          orderId: order.id,
          paymentId: payment.id,
          actualPaidVnd: payment.amount,
        });
        return "ACCEPTED";
      }

      // Nhánh 3: Đủ nguyên liệu -> chuyển Order sang PAID và tích điểm EARN đúng 1 lần trên số tiền VNPay thực trả
      await tx.updateOrderStatus(order.id, "PAID");

      const earnPoints = Math.floor(payment.amount / 1000);
      if (earnPoints > 0) {
        await tx.recordLoyaltyTransaction({
          userId: order.userId,
          orderId: order.id,
          paymentId: payment.id,
          type: "EARN",
          points: earnPoints,
          valueVnd: payment.amount,
          idempotencyKey: `earn:${order.id}`,
        });
      }

      await tx.recordPaymentEvent({
        paymentId: payment.id,
        orderId: order.id,
        eventType: source === "IPN" ? "IPN_SETTLED" : "QUERYDR_SETTLED",
        source,
        details: {
          status: "SUCCEEDED",
          orderStatus: "PAID",
          deductedIngredientsCount: deduction.deductedItems.length,
          earnPoints,
        },
      });

      return "ACCEPTED";
    });
  }
}
