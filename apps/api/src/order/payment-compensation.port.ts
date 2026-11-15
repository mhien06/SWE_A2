import type { Prisma } from "../generated/prisma/client.js";

export const PAYMENT_COMPENSATION_PORT = Symbol("PAYMENT_COMPENSATION_PORT");

export interface PaymentCompensationPort {
  compensateVerifiedPayment(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      orderId: string;
      paymentId: string;
      actualPaidVnd: number;
    },
  ): Promise<{
    outcome:
      | "GRANTED"
      | "ALREADY_COMPENSATED"
      | "SKIPPED_REFUND_SUCCEEDED"
      | "DEFERRED_REFUND_PENDING"
      | "NO_POINTS_APPLICABLE";
    pointsGranted: number;
    idempotencyKey: string;
  }>;
}
