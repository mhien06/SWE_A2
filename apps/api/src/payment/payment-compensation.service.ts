import { Injectable } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client.js";
import type { PaymentCompensationPort } from "../order/payment-compensation.port.js";
import type { PaymentTransactionContext } from "./payment.contracts.js";
import { computeVnpayCompensationPoints } from "./payment.types.js";
import { PrismaPaymentRepository } from "./prisma-payment.store.js";

export type CompensationOutcome =
  | "GRANTED"
  | "ALREADY_COMPENSATED"
  | "SKIPPED_REFUND_SUCCEEDED"
  | "DEFERRED_REFUND_PENDING"
  | "NO_POINTS_APPLICABLE";

export interface CompensationResult {
  outcome: CompensationOutcome;
  pointsGranted: number;
  idempotencyKey: string;
}

@Injectable()
export class PaymentCompensationService {
  /**
   * Thực thi quy tắc bù điểm BrewLite (SRS FR-19, FR-20; BR-08, BR-09; ADR-008):
   * - Không mở luồng refund VNPay mới.
   * - Kiểm tra VNPayRefundRecord cũ trước khi cấp điểm bù:
   *   + SUCCEEDED -> không cấp điểm trùng.
   *   + PENDING / UNKNOWN -> khóa cấp điểm bù, chờ đối soát.
   * - Cấp đúng 1 lần theo khóa `vnpay-comp:<paymentId>` với công thức ceil(actualPaidVnd / 100).
   */
  async compensateVerifiedPayment(
    tx: PaymentTransactionContext,
    input: {
      userId: string;
      orderId: string;
      paymentId: string;
      actualPaidVnd: number;
    },
  ): Promise<CompensationResult> {
    const idempotencyKey = `vnpay-comp:${input.paymentId}`;
    const existing =
      await tx.findLoyaltyTransactionByIdempotencyKey(idempotencyKey);
    if (existing) {
      return {
        outcome: "ALREADY_COMPENSATED",
        pointsGranted: existing.points,
        idempotencyKey,
      };
    }

    const refunds = await tx.listRefundRecordsByPayment(input.paymentId);
    if (refunds.some((r) => r.status === "SUCCEEDED")) {
      return {
        outcome: "SKIPPED_REFUND_SUCCEEDED",
        pointsGranted: 0,
        idempotencyKey,
      };
    }
    if (
      refunds.some((r) => r.status === "PENDING" || r.status === "UNKNOWN")
    ) {
      return {
        outcome: "DEFERRED_REFUND_PENDING",
        pointsGranted: 0,
        idempotencyKey,
      };
    }

    const points = computeVnpayCompensationPoints(input.actualPaidVnd);
    if (points <= 0) {
      return {
        outcome: "NO_POINTS_APPLICABLE",
        pointsGranted: 0,
        idempotencyKey,
      };
    }

    const record = await tx.recordLoyaltyTransaction({
      userId: input.userId,
      orderId: input.orderId,
      paymentId: input.paymentId,
      type: "VNPAY_COMPENSATION",
      points,
      valueVnd: input.actualPaidVnd,
      idempotencyKey,
    });

    return {
      outcome: "GRANTED",
      pointsGranted: record.points,
      idempotencyKey,
    };
  }

  /**
   * Hoàn lại số điểm khách đã REDEEM trên đơn khi đơn bị hủy hoặc rơi vào PAYMENT_EXCEPTION.
   */
  async returnRedeemedPointsIfAny(
    tx: PaymentTransactionContext,
    input: {
      userId: string;
      orderId: string;
      pointsRedeemed: number;
      pointsDiscountAmount: number;
    },
  ): Promise<number> {
    if (input.pointsRedeemed <= 0) {
      return 0;
    }
    const idempotencyKey = `return-redeem:${input.orderId}`;
    const existing =
      await tx.findLoyaltyTransactionByIdempotencyKey(idempotencyKey);
    if (existing) {
      return existing.points;
    }

    const created = await tx.recordLoyaltyTransaction({
      userId: input.userId,
      orderId: input.orderId,
      paymentId: null,
      type: "RETURN_REDEEMED",
      points: input.pointsRedeemed,
      valueVnd: input.pointsDiscountAmount,
      idempotencyKey,
    });
    return created.points;
  }
}

/**
 * Cầu nối PaymentCompensationPort cho OrderModule khi hủy đơn đã PAID
 * trong cùng Prisma.TransactionClient.
 */
@Injectable()
export class PrismaPaymentCompensationAdapter
  implements PaymentCompensationPort
{
  constructor(
    private readonly compensationService: PaymentCompensationService,
    private readonly prismaRepository: PrismaPaymentRepository,
  ) {}

  compensateVerifiedPayment(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      orderId: string;
      paymentId: string;
      actualPaidVnd: number;
    },
  ) {
    return this.compensationService.compensateVerifiedPayment(
      this.prismaRepository.wrapTransactionClient(tx),
      input,
    );
  }
}
