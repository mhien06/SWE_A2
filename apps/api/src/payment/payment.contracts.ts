import type {
  LoyaltyTransactionRecord,
  LoyaltyTransactionType,
  OrderSnapshotForPayment,
  OrderStatus,
  PaymentEventRecord,
  PaymentRecord,
  PaymentStatus,
  VNPayRefundRecordSnapshot,
} from "./payment.types.js";

export const PAYMENT_REPOSITORY_PORT = Symbol("PAYMENT_REPOSITORY_PORT");

export interface IngredientDeductionResult {
  sufficient: boolean;
  deductedItems: Array<{
    ingredientId: string;
    ingredientNameSnapshot: string;
    quantityDeducted: number;
    unitSnapshot: string;
  }>;
}

export interface PaymentTransactionContext {
  findPaymentByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<PaymentRecord | null>;
  findPaymentById(paymentId: string): Promise<PaymentRecord | null>;
  findPaymentByTransactionRef(
    transactionRef: string,
  ): Promise<PaymentRecord | null>;
  lockOrderById(orderId: string): Promise<OrderSnapshotForPayment | null>;
  lockPaymentByTransactionRef(
    transactionRef: string,
  ): Promise<PaymentRecord | null>;
  listOrderPayments(orderId: string): Promise<PaymentRecord[]>;
  createPaymentAttempt(
    input: Omit<PaymentRecord, "id">,
  ): Promise<PaymentRecord>;
  updatePaymentSettlement(
    paymentId: string,
    update: {
      status: PaymentStatus;
      providerTransactionNo: string | null;
      responseCode: string | null;
      transactionStatus: string | null;
      bankCode: string | null;
      payDate: string | null;
      verifiedAt: Date | null;
      settlementSource: "IPN" | "QUERY";
      reviewRequired?: boolean;
    },
  ): Promise<PaymentRecord>;
  updateOrderStatus(orderId: string, status: OrderStatus): Promise<void>;
  deductIngredientsForOrder(
    orderId: string,
  ): Promise<IngredientDeductionResult>;
  listRefundRecordsByPayment(
    paymentId: string,
  ): Promise<VNPayRefundRecordSnapshot[]>;
  findLoyaltyTransactionByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<LoyaltyTransactionRecord | null>;
  recordLoyaltyTransaction(input: {
    userId: string;
    orderId: string | null;
    paymentId: string | null;
    type: LoyaltyTransactionType;
    points: number;
    valueVnd: number | null;
    idempotencyKey: string;
  }): Promise<LoyaltyTransactionRecord>;
  recordPaymentEvent(
    input: Omit<PaymentEventRecord, "id" | "createdAt">,
  ): Promise<PaymentEventRecord>;
  recordAutomaticOrderCancellation(input: {
    orderId: string;
    reason: string;
    idempotencyKey: string;
  }): Promise<void>;
}

export interface PaymentRepositoryPort {
  runInTransaction<T>(
    work: (tx: PaymentTransactionContext) => Promise<T>,
  ): Promise<T>;
  findOrderWithLatestPayment(
    userId: string,
    orderId: string,
  ): Promise<{
    order: OrderSnapshotForPayment;
    latestPayment: PaymentRecord | null;
    hasReviewRequired: boolean;
  } | null>;
  findPaymentForUser(
    userId: string,
    paymentId: string,
  ): Promise<{
    order: OrderSnapshotForPayment;
    payment: PaymentRecord;
  } | null>;
  claimNextPaymentForReconciliation(
    now: Date,
    maxAttempts: number,
  ): Promise<PaymentRecord | null>;
  markPaymentUnknownOrReview(
    paymentId: string,
    now: Date,
    maxAttempts: number,
  ): Promise<void>;
  listExpiredUnpaidOrderIds(now: Date, limit: number): Promise<string[]>;
}
