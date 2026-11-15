import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PaymentCompensationService } from "../payment/payment-compensation.service.js";
import { PaymentSettlementService } from "../payment/payment-settlement.service.js";
import {
  PAYMENT_REPOSITORY_PORT,
  type PaymentRepositoryPort,
} from "../payment/payment.contracts.js";
import { isUnresolvedPaymentStatus } from "../payment/payment.types.js";
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from "../vnpay/vnpay.types.js";

const DEFAULT_MAX_QUERYDR_ATTEMPTS = 5;

@Injectable()
export class PaymentReconciliationService
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(PaymentReconciliationService.name);

  constructor(
    @Inject(PAYMENT_REPOSITORY_PORT)
    private readonly repository: PaymentRepositoryPort,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
    private readonly settlement: PaymentSettlementService,
    private readonly compensation: PaymentCompensationService,
  ) {}

  onModuleInit() {
    if (
      process.env.NODE_ENV === "test" ||
      process.env.PAYMENT_RECONCILIATION_ENABLED === "false"
    ) {
      return;
    }
    this.timer = setInterval(() => {
      void this.runCycle();
    }, 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /**
   * Chạy một chu kỳ đối soát gồm 2 nhiệm vụ theo ADR-007:
   * 1) Đối soát các Payment PENDING/UNKNOWN bằng QueryDR (gọi ngoài DB transaction).
   * 2) Tự hủy các Order PENDING/PAYMENT_FAILED đã quá hạn 15 phút CHỈ KHI
   *    đã đối soát xong và không có bất kỳ Payment SUCCEEDED hay PENDING/UNKNOWN nào.
   */
  async runCycle(now: Date = new Date()): Promise<{
    reconciledPayments: number;
    expiredOrdersCancelled: number;
  }> {
    if (this.running) {
      return { reconciledPayments: 0, expiredOrdersCancelled: 0 };
    }
    this.running = true;

    let reconciledPayments = 0;
    let expiredOrdersCancelled = 0;
    const maxAttempts = Number(
      process.env.PAYMENT_MAX_QUERYDR_ATTEMPTS ?? DEFAULT_MAX_QUERYDR_ATTEMPTS,
    );

    try {
      for (let i = 0; i < 20; i++) {
        const claimed =
          await this.repository.claimNextPaymentForReconciliation(
            now,
            maxAttempts,
          );
        if (!claimed) {
          break;
        }
        reconciledPayments++;

        try {
          const evidence = await this.gateway.queryTransaction({
            orderId: claimed.orderId,
            transactionRef: claimed.transactionRef,
            amount: claimed.amount,
            createdAt: claimed.createdAt,
            expiresAt: claimed.expiresAt,
            ipAddress: "127.0.0.1",
          });

          if (evidence) {
            await this.settlement.settle(evidence, "QUERY");
          } else {
            await this.repository.markPaymentUnknownOrReview(
              claimed.id,
              now,
              maxAttempts,
            );
          }
        } catch {
          await this.repository.markPaymentUnknownOrReview(
            claimed.id,
            now,
            maxAttempts,
          );
          this.logger.warn(
            `QueryDR pending for payment ${claimed.id}; scheduled for retry.`,
          );
        }
      }

      const expiredOrderIds = await this.repository.listExpiredUnpaidOrderIds(
        now,
        20,
      );
      for (const orderId of expiredOrderIds) {
        const cancelled = await this.tryAutoCancelExpiredOrder(orderId, now);
        if (cancelled) {
          expiredOrdersCancelled++;
        }
      }

      return { reconciledPayments, expiredOrdersCancelled };
    } finally {
      this.running = false;
    }
  }

  private async tryAutoCancelExpiredOrder(
    orderId: string,
    now: Date,
  ): Promise<boolean> {
    return this.repository.runInTransaction(async (tx) => {
      const order = await tx.lockOrderById(orderId);
      if (!order) {
        return false;
      }

      if (
        (order.status !== "PENDING" && order.status !== "PAYMENT_FAILED") ||
        order.expiresAt.getTime() > now.getTime()
      ) {
        return false;
      }

      const payments = await tx.listOrderPayments(order.id);
      const hasSucceeded = payments.some((p) => p.status === "SUCCEEDED");
      const hasUnresolved = payments.some((p) =>
        isUnresolvedPaymentStatus(p.status),
      );

      // ADR-007: Tuyệt đối không tự hủy nếu có giao dịch SUCCEEDED hoặc còn PENDING/UNKNOWN chưa rõ!
      if (hasSucceeded || hasUnresolved) {
        return false;
      }

      await tx.updateOrderStatus(order.id, "CANCELLED");
      await tx.recordAutomaticOrderCancellation({
        orderId: order.id,
        reason: "Đơn hàng tự hủy do quá thời hạn thanh toán 15 phút.",
        idempotencyKey: `auto-cancel:${order.id}`,
      });

      await this.compensation.returnRedeemedPointsIfAny(tx, {
        userId: order.userId,
        orderId: order.id,
        pointsRedeemed: order.pointsRedeemed,
        pointsDiscountAmount: order.pointsDiscountAmount,
      });

      return true;
    });
  }
}
