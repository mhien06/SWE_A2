import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  IngredientDeductionResult,
  PaymentRepositoryPort,
  PaymentTransactionContext,
} from "./payment.contracts.js";
import {
  isUnresolvedPaymentStatus,
  type LoyaltyTransactionRecord,
  type OrderSnapshotForPayment,
  type OrderStatus,
  type PaymentEventRecord,
  type PaymentRecord,
  type VNPayRefundRecordSnapshot,
} from "./payment.types.js";

/**
 * In-memory / transactional store adapter phục vụ kiểm thử độc lập và làm
 * fallback an toàn trước khi migration Order/Inventory/Loyalty của Issue #20
 * được gộp. Khi tích hợp với Prisma schema của Khoa, có thể override
 * PAYMENT_REPOSITORY_PORT hoặc nối trực tiếp vào các bảng Prisma tương ứng.
 */
@Injectable()
export class InMemoryPaymentRepository implements PaymentRepositoryPort {
  private readonly orders = new Map<string, OrderSnapshotForPayment>();
  private readonly payments = new Map<string, PaymentRecord>();
  private readonly refunds = new Map<string, VNPayRefundRecordSnapshot[]>();
  private readonly loyaltyLedger = new Map<string, LoyaltyTransactionRecord>();
  private readonly userPoints = new Map<string, number>();
  private readonly events: PaymentEventRecord[] = [];
  private readonly orderIngredientShortage = new Set<string>();
  private readonly deductedOrders = new Set<string>();
  private readonly cancelledOrders = new Map<
    string,
    { reason: string; isAutomatic: boolean; idempotencyKey: string }
  >();
  private readonly claimedLocks = new Set<string>();
  private txQueue: Promise<unknown> = Promise.resolve();

  seedOrder(
    order: OrderSnapshotForPayment,
    options?: { insufficientIngredients?: boolean; initialPointsBalance?: number },
  ) {
    this.orders.set(order.id, { ...order });
    if (options?.insufficientIngredients) {
      this.orderIngredientShortage.add(order.id);
    } else {
      this.orderIngredientShortage.delete(order.id);
    }
    if (typeof options?.initialPointsBalance === "number") {
      this.userPoints.set(order.userId, options.initialPointsBalance);
    }
  }

  setOrderInsufficientIngredients(orderId: string, insufficient: boolean) {
    if (insufficient) {
      this.orderIngredientShortage.add(orderId);
    } else {
      this.orderIngredientShortage.delete(orderId);
    }
  }

  seedRefundRecord(record: VNPayRefundRecordSnapshot) {
    const existing = this.refunds.get(record.paymentId) ?? [];
    existing.push({ ...record });
    this.refunds.set(record.paymentId, existing);
  }

  getOrder(orderId: string): OrderSnapshotForPayment | undefined {
    const found = this.orders.get(orderId);
    return found ? { ...found } : undefined;
  }

  getPayment(paymentId: string): PaymentRecord | undefined {
    const found = this.payments.get(paymentId);
    return found ? { ...found } : undefined;
  }

  getUserPointsBalance(userId: string): number {
    return this.userPoints.get(userId) ?? 0;
  }

  listLoyaltyTransactions(): LoyaltyTransactionRecord[] {
    return Array.from(this.loyaltyLedger.values());
  }

  listPaymentEvents(): PaymentEventRecord[] {
    return [...this.events];
  }

  isOrderDeducted(orderId: string): boolean {
    return this.deductedOrders.has(orderId);
  }

  async runInTransaction<T>(
    work: (tx: PaymentTransactionContext) => Promise<T>,
  ): Promise<T> {
    const previous = this.txQueue;
    let release!: () => void;
    this.txQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    const ordersSnapshot = new Map(
      Array.from(this.orders.entries()).map(([k, v]) => [k, { ...v }]),
    );
    const paymentsSnapshot = new Map(
      Array.from(this.payments.entries()).map(([k, v]) => [k, { ...v }]),
    );
    const loyaltySnapshot = new Map(
      Array.from(this.loyaltyLedger.entries()).map(([k, v]) => [k, { ...v }]),
    );
    const pointsSnapshot = new Map(this.userPoints);
    const eventsLength = this.events.length;
    const deductedSnapshot = new Set(this.deductedOrders);
    const cancelledSnapshot = new Map(this.cancelledOrders);

    const tx: PaymentTransactionContext = {
      findPaymentByIdempotencyKey: async (idempotencyKey) => {
        for (const payment of this.payments.values()) {
          if (payment.idempotencyKey === idempotencyKey) {
            return { ...payment };
          }
        }
        return null;
      },
      findPaymentById: async (paymentId) => {
        const payment = this.payments.get(paymentId);
        return payment ? { ...payment } : null;
      },
      findPaymentByTransactionRef: async (transactionRef) => {
        for (const payment of this.payments.values()) {
          if (payment.transactionRef === transactionRef) {
            return { ...payment };
          }
        }
        return null;
      },
      lockOrderById: async (orderId) => {
        const order = this.orders.get(orderId);
        return order ? { ...order } : null;
      },
      lockPaymentByTransactionRef: async (transactionRef) => {
        for (const payment of this.payments.values()) {
          if (payment.transactionRef === transactionRef) {
            return { ...payment };
          }
        }
        return null;
      },
      listOrderPayments: async (orderId) => {
        return Array.from(this.payments.values())
          .filter((p) => p.orderId === orderId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((p) => ({ ...p }));
      },
      createPaymentAttempt: async (input) => {
        for (const existing of this.payments.values()) {
          if (existing.idempotencyKey === input.idempotencyKey) {
            throw new Error("UNIQUE_VIOLATION:idempotencyKey");
          }
          if (existing.transactionRef === input.transactionRef) {
            throw new Error("UNIQUE_VIOLATION:transactionRef");
          }
        }
        const record: PaymentRecord = {
          ...input,
          id: randomUUID(),
        };
        this.payments.set(record.id, record);
        return { ...record };
      },
      updatePaymentSettlement: async (paymentId, update) => {
        const current = this.payments.get(paymentId);
        if (!current) {
          throw new Error(`Payment ${paymentId} not found`);
        }
        const updated: PaymentRecord = {
          ...current,
          status: update.status,
          providerTransactionNo: update.providerTransactionNo,
          responseCode: update.responseCode,
          transactionStatus: update.transactionStatus,
          bankCode: update.bankCode,
          payDate: update.payDate,
          verifiedAt: update.verifiedAt,
          settlementSource: update.settlementSource,
          reviewRequired: update.reviewRequired ?? current.reviewRequired,
        };
        this.payments.set(paymentId, updated);
        return { ...updated };
      },
      updateOrderStatus: async (orderId: string, status: OrderStatus) => {
        const current = this.orders.get(orderId);
        if (!current) {
          throw new Error(`Order ${orderId} not found`);
        }
        this.orders.set(orderId, { ...current, status });
      },
      deductIngredientsForOrder: async (
        orderId: string,
      ): Promise<IngredientDeductionResult> => {
        if (this.orderIngredientShortage.has(orderId)) {
          return { sufficient: false, deductedItems: [] };
        }
        this.deductedOrders.add(orderId);
        return {
          sufficient: true,
          deductedItems: [
            {
              ingredientId: "ing-coffee-beans",
              ingredientNameSnapshot: "Hạt cà phê rang mộc",
              quantityDeducted: 20,
              unitSnapshot: "GRAM",
            },
          ],
        };
      },
      listRefundRecordsByPayment: async (paymentId) => {
        return (this.refunds.get(paymentId) ?? []).map((r) => ({ ...r }));
      },
      findLoyaltyTransactionByIdempotencyKey: async (idempotencyKey) => {
        const existing = this.loyaltyLedger.get(idempotencyKey);
        return existing ? { ...existing } : null;
      },
      recordLoyaltyTransaction: async (input) => {
        if (this.loyaltyLedger.has(input.idempotencyKey)) {
          return { ...this.loyaltyLedger.get(input.idempotencyKey)! };
        }
        for (const item of this.loyaltyLedger.values()) {
          if (
            input.type === "VNPAY_COMPENSATION" &&
            input.paymentId &&
            item.paymentId === input.paymentId &&
            item.type === "VNPAY_COMPENSATION"
          ) {
            return { ...item };
          }
        }
        const record: LoyaltyTransactionRecord = {
          id: randomUUID(),
          userId: input.userId,
          orderId: input.orderId,
          paymentId: input.paymentId,
          type: input.type,
          points: input.points,
          valueVnd: input.valueVnd,
          idempotencyKey: input.idempotencyKey,
          createdAt: new Date(),
        };
        this.loyaltyLedger.set(record.idempotencyKey, record);
        const currentPoints = this.userPoints.get(input.userId) ?? 0;
        this.userPoints.set(input.userId, currentPoints + input.points);
        return { ...record };
      },
      recordPaymentEvent: async (input) => {
        const event: PaymentEventRecord = {
          ...input,
          id: randomUUID(),
          createdAt: new Date(),
        };
        this.events.push(event);
        return { ...event };
      },
      recordAutomaticOrderCancellation: async (input) => {
        if (!this.cancelledOrders.has(input.orderId)) {
          this.cancelledOrders.set(input.orderId, {
            reason: input.reason,
            isAutomatic: true,
            idempotencyKey: input.idempotencyKey,
          });
        }
      },
    };

    try {
      return await work(tx);
    } catch (error) {
      this.orders.clear();
      for (const [k, v] of ordersSnapshot) this.orders.set(k, v);
      this.payments.clear();
      for (const [k, v] of paymentsSnapshot) this.payments.set(k, v);
      this.loyaltyLedger.clear();
      for (const [k, v] of loyaltySnapshot) this.loyaltyLedger.set(k, v);
      this.userPoints.clear();
      for (const [k, v] of pointsSnapshot) this.userPoints.set(k, v);
      this.events.length = eventsLength;
      this.deductedOrders.clear();
      for (const item of deductedSnapshot) this.deductedOrders.add(item);
      this.cancelledOrders.clear();
      for (const [k, v] of cancelledSnapshot) this.cancelledOrders.set(k, v);
      throw error;
    } finally {
      release();
    }
  }

  async findOrderWithLatestPayment(userId: string, orderId: string) {
    const order = this.orders.get(orderId);
    if (!order || order.userId !== userId) {
      return null;
    }
    const payments = Array.from(this.payments.values())
      .filter((p) => p.orderId === orderId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      order: { ...order },
      latestPayment: payments[0] ? { ...payments[0] } : null,
      hasReviewRequired: payments.some((p) => p.reviewRequired),
    };
  }

  async findPaymentForUser(userId: string, paymentId: string) {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      return null;
    }
    const order = this.orders.get(payment.orderId);
    if (!order || order.userId !== userId) {
      return null;
    }
    return {
      order: { ...order },
      payment: { ...payment },
    };
  }

  async claimNextPaymentForReconciliation(
    now: Date,
    maxAttempts: number,
  ): Promise<PaymentRecord | null> {
    const candidates = Array.from(this.payments.values())
      .filter(
        (p) =>
          isUnresolvedPaymentStatus(p.status) &&
          !p.reviewRequired &&
          p.queryAttempts < maxAttempts &&
          p.nextQueryAt.getTime() <= now.getTime() &&
          !this.claimedLocks.has(p.id),
      )
      .sort((a, b) => a.nextQueryAt.getTime() - b.nextQueryAt.getTime());

    const candidate = candidates[0];
    if (!candidate) {
      return null;
    }

    this.claimedLocks.add(candidate.id);
    try {
      const updated: PaymentRecord = {
        ...candidate,
        queryAttempts: candidate.queryAttempts + 1,
        nextQueryAt: new Date(now.getTime() + 60_000),
      };
      this.payments.set(candidate.id, updated);
      return { ...updated };
    } finally {
      this.claimedLocks.delete(candidate.id);
    }
  }

  async markPaymentUnknownOrReview(
    paymentId: string,
    now: Date,
    maxAttempts: number,
  ): Promise<void> {
    const current = this.payments.get(paymentId);
    if (!current || !isUnresolvedPaymentStatus(current.status)) {
      return;
    }
    const reachedCap = current.queryAttempts >= maxAttempts;
    this.payments.set(paymentId, {
      ...current,
      status: "UNKNOWN",
      reviewRequired: reachedCap ? true : current.reviewRequired,
      nextQueryAt: new Date(
        now.getTime() + Math.min(current.queryAttempts, 5) * 60_000,
      ),
    });
  }

  async listExpiredUnpaidOrderIds(now: Date, limit: number): Promise<string[]> {
    return Array.from(this.orders.values())
      .filter(
        (order) =>
          (order.status === "PENDING" || order.status === "PAYMENT_FAILED") &&
          order.expiresAt.getTime() <= now.getTime(),
      )
      .slice(0, limit)
      .map((order) => order.id);
  }
}
