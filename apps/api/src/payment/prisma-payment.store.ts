import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  Prisma,
  type Order as PrismaOrder,
  type OrderItem as PrismaOrderItem,
  type Payment as PrismaPayment,
  type VNPayRefundRecord as PrismaRefundRecord,
  type LoyaltyTransaction as PrismaLoyaltyTx,
} from "../generated/prisma/client.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { LoyaltyService } from "../loyalty/loyalty.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type {
  IngredientDeductionResult,
  PaymentRepositoryPort,
  PaymentTransactionContext,
} from "./payment.contracts.js";
import {
  isUnresolvedPaymentStatus,
  type LoyaltyTransactionRecord,
  type OrderItemSnapshotForPayment,
  type OrderSnapshotForPayment,
  type OrderStatus,
  type PaymentEventRecord,
  type PaymentRecord,
  type VNPayRefundRecordSnapshot,
} from "./payment.types.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function mapOrderItem(item: PrismaOrderItem): OrderItemSnapshotForPayment {
  return {
    id: item.id,
    productId: item.productId,
    productNameSnapshot: item.productNameSnapshot,
    selectedSizeSnapshot: item.selectedSizeSnapshot,
    selectedToppingsSnapshot: [...item.selectedToppingsSnapshot],
    unitPriceSnapshot: item.unitPriceSnapshot,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
  };
}

function mapOrder(
  order: PrismaOrder & { items?: PrismaOrderItem[] },
): OrderSnapshotForPayment {
  return {
    id: order.id,
    orderCode: order.orderCode,
    userId: order.userId,
    status: order.status,
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    totalAmount: order.totalAmount,
    pointsRedeemed: order.pointsRedeemed,
    pointsDiscountAmount: order.pointsDiscountAmount,
    vnpayPayableAmount: order.vnpayPayableAmount,
    createdAt: order.createdAt,
    expiresAt: order.expiresAt,
    items: order.items?.map(mapOrderItem),
  };
}

function mapPayment(payment: PrismaPayment): PaymentRecord {
  return {
    id: payment.id,
    orderId: payment.orderId,
    provider: payment.provider,
    status: payment.status,
    amount: payment.amount,
    transactionRef: payment.transactionRef,
    idempotencyKey: payment.idempotencyKey,
    payloadHash: payment.payloadHash,
    paymentUrl: payment.paymentUrl,
    providerTransactionNo: payment.providerTransactionNo,
    responseCode: payment.responseCode,
    transactionStatus: payment.transactionStatus,
    bankCode: payment.bankCode,
    payDate: payment.payDate,
    createdAt: payment.createdAt,
    expiresAt: payment.expiresAt,
    verifiedAt: payment.verifiedAt,
    nextQueryAt: payment.nextQueryAt,
    queryAttempts: payment.queryAttempts,
    reviewRequired: payment.reviewRequired,
    settlementSource:
      payment.settlementSource === "IPN" || payment.settlementSource === "QUERY"
        ? payment.settlementSource
        : null,
  };
}

function mapRefundRecord(row: PrismaRefundRecord): VNPayRefundRecordSnapshot {
  return {
    id: row.id,
    paymentId: row.paymentId,
    amount: row.amount,
    status: row.status,
    providerRefundRef: row.providerRefundRef,
    requestedAt: row.requestedAt,
    resolvedAt: row.resolvedAt,
  };
}

function mapLoyaltyTx(row: PrismaLoyaltyTx): LoyaltyTransactionRecord {
  return {
    id: row.id,
    userId: row.userId,
    orderId: row.orderId,
    paymentId: row.paymentId,
    type: row.type,
    points: row.points,
    valueVnd: row.valueVnd,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt,
  };
}

/**
 * Adapter Prisma PostgreSQL chính thức nối PaymentModule vào schema & service
 * của Issue #20 (PrismaService, InventoryService, LoyaltyService).
 */
@Injectable()
export class PrismaPaymentRepository implements PaymentRepositoryPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly loyalty: LoyaltyService,
  ) {}

  async runInTransaction<T>(
    work: (tx: PaymentTransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (client) => work(this.wrapTransactionClient(client)),
      { maxWait: 5_000, timeout: 15_000 },
    );
  }

  wrapTransactionClient(
    client: Prisma.TransactionClient,
  ): PaymentTransactionContext {
    return {
      findPaymentByIdempotencyKey: async (idempotencyKey) => {
        const found = await client.payment.findUnique({
          where: { idempotencyKey },
        });
        return found ? mapPayment(found) : null;
      },
      findPaymentById: async (paymentId) => {
        if (!isUuid(paymentId)) return null;
        const found = await client.payment.findUnique({
          where: { id: paymentId },
        });
        return found ? mapPayment(found) : null;
      },
      findPaymentByTransactionRef: async (transactionRef) => {
        const found = await client.payment.findUnique({
          where: { transactionRef },
        });
        return found ? mapPayment(found) : null;
      },
      lockOrderById: async (orderId) => {
        if (!isUuid(orderId)) return null;
        await client.$queryRaw(
          Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = CAST(${orderId} AS uuid) FOR UPDATE`,
        );
        const order = await client.order.findUnique({
          where: { id: orderId },
          include: { items: true },
        });
        return order ? mapOrder(order) : null;
      },
      lockPaymentByTransactionRef: async (transactionRef) => {
        await client.$queryRaw(
          Prisma.sql`SELECT "id" FROM "Payment" WHERE "transactionRef" = ${transactionRef} FOR UPDATE`,
        );
        const payment = await client.payment.findUnique({
          where: { transactionRef },
        });
        return payment ? mapPayment(payment) : null;
      },
      listOrderPayments: async (orderId) => {
        if (!isUuid(orderId)) return [];
        const rows = await client.payment.findMany({
          where: { orderId },
          orderBy: { createdAt: "asc" },
        });
        return rows.map(mapPayment);
      },
      createPaymentAttempt: async (input) => {
        const created = await client.payment.create({
          data: {
            orderId: input.orderId,
            provider: input.provider,
            status: input.status,
            amount: input.amount,
            transactionRef: input.transactionRef,
            idempotencyKey: input.idempotencyKey,
            payloadHash: input.payloadHash,
            paymentUrl: input.paymentUrl,
            providerTransactionNo: input.providerTransactionNo,
            responseCode: input.responseCode,
            transactionStatus: input.transactionStatus,
            bankCode: input.bankCode,
            payDate: input.payDate,
            createdAt: input.createdAt,
            expiresAt: input.expiresAt,
            verifiedAt: input.verifiedAt,
            nextQueryAt: input.nextQueryAt,
            queryAttempts: input.queryAttempts,
            reviewRequired: input.reviewRequired,
            settlementSource: input.settlementSource,
          },
        });
        return mapPayment(created);
      },
      updatePaymentSettlement: async (paymentId, update) => {
        const updated = await client.payment.update({
          where: { id: paymentId },
          data: {
            status: update.status,
            providerTransactionNo: update.providerTransactionNo,
            responseCode: update.responseCode,
            transactionStatus: update.transactionStatus,
            bankCode: update.bankCode,
            payDate: update.payDate,
            verifiedAt: update.verifiedAt,
            settlementSource: update.settlementSource,
            ...(update.reviewRequired !== undefined
              ? { reviewRequired: update.reviewRequired }
              : {}),
          },
        });
        return mapPayment(updated);
      },
      updateOrderStatus: async (orderId, status) => {
        await client.order.update({
          where: { id: orderId },
          data: { status },
        });
      },
      deductIngredientsForOrder: async (
        orderId,
      ): Promise<IngredientDeductionResult> => {
        return this.inventory.deductIngredientsForOrder(client, orderId);
      },
      listRefundRecordsByPayment: async (paymentId) => {
        const rows = await client.vNPayRefundRecord.findMany({
          where: { paymentId },
          orderBy: { requestedAt: "desc" },
        });
        return rows.map(mapRefundRecord);
      },
      findLoyaltyTransactionByIdempotencyKey: async (idempotencyKey) => {
        const found = await client.loyaltyTransaction.findUnique({
          where: { idempotencyKey },
        });
        return found ? mapLoyaltyTx(found) : null;
      },
      recordLoyaltyTransaction: async (input) => {
        const created = await this.loyalty.recordInTransaction(client, input);
        return mapLoyaltyTx(created);
      },
      recordPaymentEvent: async (input) => {
        const created = await client.paymentEvent.create({
          data: {
            paymentId: input.paymentId,
            orderId: input.orderId,
            eventType: input.eventType,
            source: input.source,
            details: input.details as Prisma.InputJsonValue,
          },
        });
        return {
          id: created.id,
          paymentId: created.paymentId,
          orderId: created.orderId,
          eventType: input.eventType,
          source: input.source,
          details: input.details,
          createdAt: created.createdAt,
        };
      },
      recordAutomaticOrderCancellation: async (input) => {
        const existing = await client.orderCancellation.findUnique({
          where: { orderId: input.orderId },
        });
        if (existing) {
          return;
        }
        const order = await client.order.findUnique({
          where: { id: input.orderId },
        });
        if (!order) {
          return;
        }
        if (order.pointsRedeemed > 0) {
          await this.loyalty.returnRedeemedPoints(client, {
            userId: order.userId,
            orderId: order.id,
            pointsRedeemed: order.pointsRedeemed,
            pointsDiscountAmount: order.pointsDiscountAmount,
          });
        }
        await client.orderCancellation.create({
          data: {
            orderId: input.orderId,
            cancelledByUserId: null,
            cancelledByRole: "SYSTEM",
            reason: input.reason,
            isAutomatic: true,
            idempotencyKey: input.idempotencyKey,
          },
        });
      },
    };
  }

  async findOrderWithLatestPayment(userId: string, orderId: string) {
    if (!isUuid(orderId)) return null;
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: true,
        payments: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!order) {
      return null;
    }
    const payments = order.payments.map(mapPayment);
    return {
      order: mapOrder(order),
      latestPayment: payments[0] ?? null,
      hasReviewRequired: payments.some((p) => p.reviewRequired),
    };
  }

  async findPaymentForUser(userId: string, paymentId: string) {
    if (!isUuid(paymentId)) return null;
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, order: { userId } },
      include: {
        order: { include: { items: true } },
      },
    });
    if (!payment) {
      return null;
    }
    return {
      order: mapOrder(payment.order),
      payment: mapPayment(payment),
    };
  }

  async claimNextPaymentForReconciliation(
    now: Date,
    maxAttempts: number,
  ): Promise<PaymentRecord | null> {
    return this.prisma.$transaction(async (client) => {
      const candidates = await client.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          SELECT "id"
          FROM "Payment"
          WHERE "status" IN ('PENDING', 'UNKNOWN')
            AND "reviewRequired" = false
            AND "queryAttempts" < ${maxAttempts}
            AND "nextQueryAt" <= ${now}
          ORDER BY "nextQueryAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        `,
      );
      const id = candidates[0]?.id;
      if (!id) {
        return null;
      }
      const updated = await client.payment.update({
        where: { id },
        data: {
          queryAttempts: { increment: 1 },
          nextQueryAt: new Date(now.getTime() + 60_000),
        },
      });
      return mapPayment(updated);
    });
  }

  async markPaymentUnknownOrReview(
    paymentId: string,
    now: Date,
    maxAttempts: number,
  ): Promise<void> {
    if (!isUuid(paymentId)) return;
    await this.prisma.$transaction(async (client) => {
      await client.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = CAST(${paymentId} AS uuid) FOR UPDATE`,
      );
      const current = await client.payment.findUnique({
        where: { id: paymentId },
      });
      if (!current || !isUnresolvedPaymentStatus(current.status)) {
        return;
      }
      const reachedCap = current.queryAttempts >= maxAttempts;
      await client.payment.update({
        where: { id: paymentId },
        data: {
          status: "UNKNOWN",
          reviewRequired: reachedCap ? true : current.reviewRequired,
          nextQueryAt: new Date(
            now.getTime() + Math.min(current.queryAttempts, 5) * 60_000,
          ),
        },
      });
      if (reachedCap && !current.reviewRequired) {
        await client.paymentEvent.create({
          data: {
            paymentId: current.id,
            orderId: current.orderId,
            eventType: "MANUAL_REVIEW_FLAGGED",
            source: "SCHEDULER",
            details: { queryAttempts: current.queryAttempts },
          },
        });
      }
    });
  }

  async listExpiredUnpaidOrderIds(now: Date, limit: number): Promise<string[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: ["PENDING", "PAYMENT_FAILED"] },
        expiresAt: { lte: now },
      },
      orderBy: { expiresAt: "asc" },
      take: limit,
      select: { id: true },
    });
    return orders.map((order) => order.id);
  }
}

/**
 * In-memory / transactional store adapter phục vụ kiểm thử unit & integration
 * nhanh mà không cần PostgreSQL sống.
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
    options?: {
      insufficientIngredients?: boolean;
      initialPointsBalance?: number;
    },
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
