export type PaymentStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "UNKNOWN"
  | "EXPIRED";

export type PaymentProvider = "VNPAY_SANDBOX";

export interface PaymentGatewayRequest {
  orderId: string;
  transactionRef: string;
  amount: number;
  ipAddress: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface PaymentEvidence {
  transactionRef: string;
  amount: number;
  status: Exclude<PaymentStatus, "PENDING">;
  responseCode: string;
  transactionStatus: string;
  providerTransactionNo: string;
  bankCode: string;
  payDate: string;
}

export interface ReturnUrlVerificationResult {
  validSignature: boolean;
  orderId: string | null;
  transactionRef: string | null;
  responseCode: string | null;
  transactionStatus: string | null;
}

export const PAYMENT_GATEWAY = Symbol("PAYMENT_GATEWAY");

export interface PaymentGateway {
  createPaymentUrl(request: PaymentGatewayRequest): string;
  verifyNotification(query: Record<string, unknown>): PaymentEvidence | null;
  verifyReturnUrl(query: Record<string, unknown>): ReturnUrlVerificationResult;
  queryTransaction(
    request: PaymentGatewayRequest,
  ): Promise<PaymentEvidence | null>;
}
