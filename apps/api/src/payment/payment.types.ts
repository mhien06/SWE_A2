import type { PaymentProvider, PaymentStatus } from "../vnpay/vnpay.types.js";

export type { PaymentProvider, PaymentStatus };

export type OrderStatus =
  | "PENDING"
  | "PAYMENT_FAILED"
  | "PAYMENT_EXCEPTION"
  | "PAID"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "COMPLETED"
  | "CANCELLED";

export type RefundStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "UNKNOWN";

export type LoyaltyTransactionType =
  | "EARN"
  | "REDEEM"
  | "RETURN_REDEEMED"
  | "REVERSE_EARNED"
  | "VNPAY_COMPENSATION"
  | "ADJUST";

export interface OrderItemSnapshotForPayment {
  id: string;
  productId: string;
  productNameSnapshot: string;
  selectedSizeSnapshot: string;
  selectedToppingsSnapshot: string[];
  unitPriceSnapshot: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderSnapshotForPayment {
  id: string;
  orderCode: string;
  userId: string;
  status: OrderStatus;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  pointsRedeemed: number;
  pointsDiscountAmount: number;
  vnpayPayableAmount: number;
  createdAt: Date;
  expiresAt: Date;
  items?: OrderItemSnapshotForPayment[];
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  transactionRef: string;
  idempotencyKey: string;
  payloadHash: string;
  paymentUrl: string;
  providerTransactionNo: string | null;
  responseCode: string | null;
  transactionStatus: string | null;
  bankCode: string | null;
  payDate: string | null;
  createdAt: Date;
  expiresAt: Date;
  verifiedAt: Date | null;
  nextQueryAt: Date;
  queryAttempts: number;
  reviewRequired: boolean;
  settlementSource: "IPN" | "QUERY" | null;
}

export interface VNPayRefundRecordSnapshot {
  id: string;
  paymentId: string;
  amount: number;
  status: RefundStatus;
  providerRefundRef: string | null;
  requestedAt: Date;
  resolvedAt: Date | null;
}

export interface LoyaltyTransactionRecord {
  id: string;
  userId: string;
  orderId: string | null;
  paymentId: string | null;
  type: LoyaltyTransactionType;
  points: number;
  valueVnd: number | null;
  idempotencyKey: string;
  createdAt: Date;
}

export interface PaymentEventRecord {
  id: string;
  paymentId: string;
  orderId: string;
  eventType:
    | "ATTEMPT_CREATED"
    | "IPN_SETTLED"
    | "QUERYDR_SETTLED"
    | "LATE_SUCCESS_AFTER_CANCEL"
    | "INSUFFICIENT_INGREDIENTS"
    | "SUCCESS_AFTER_TERMINAL_FAILURE"
    | "MANUAL_REVIEW_FLAGGED";
  source: "API" | "IPN" | "QUERY" | "SCHEDULER";
  details: Record<string, unknown>;
  createdAt: Date;
}

export function isUnresolvedPaymentStatus(status: PaymentStatus): boolean {
  return status === "PENDING" || status === "UNKNOWN";
}

/**
 * Công thức bù điểm BrewLite theo SRS FR-19 và ADR-008:
 * points = ceil(VNPay thực trả VND / 100). Ví dụ 29.050đ -> 291 điểm.
 */
export function computeVnpayCompensationPoints(actualPaidVnd: number): number {
  if (!Number.isFinite(actualPaidVnd) || actualPaidVnd <= 0) {
    return 0;
  }
  return Math.ceil(actualPaidVnd / 100);
}
