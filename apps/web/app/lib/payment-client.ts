export type OrderStatus =
  | "PENDING"
  | "PAYMENT_FAILED"
  | "PAYMENT_EXCEPTION"
  | "PAID"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "UNKNOWN"
  | "EXPIRED";

export interface OrderItemSnapshot {
  id?: string;
  productId: string;
  productNameSnapshot: string;
  selectedSizeSnapshot?: string | null;
  selectedToppingsSnapshot?: string[];
  unitPriceSnapshot: number;
  quantity: number;
  lineTotal: number;
}

export interface PaymentAttemptDto {
  paymentId: string;
  orderId: string;
  orderStatus: OrderStatus;
  provider: "VNPAY_SANDBOX";
  transactionRef: string;
  idempotencyKey: string;
  amount: number;
  status: PaymentStatus;
  createdAt: string;
  expiresAt: string;
  orderExpiresAt: string;
  verifiedAt: string | null;
  awaitingVerification: boolean;
  paymentUrl: string | null;
  needsReview: boolean;
}

export interface OrderPaymentStatusDto {
  orderId: string;
  orderCode?: string;
  orderStatus: OrderStatus;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  pointsRedeemed: number;
  pointsDiscountAmount: number;
  vnpayPayableAmount: number;
  orderExpiresAt: string;
  items?: OrderItemSnapshot[];
  payment: PaymentAttemptDto | null;
  canPay: boolean;
  canRetry: boolean;
  needsReview: boolean;
}

export interface ClientSession {
  accessToken: string;
  account: {
    id?: string;
    fullName: string;
    email: string;
    role: "CUSTOMER" | "STAFF" | "MANAGER";
  };
}

export interface CartItemDraft {
  key: string;
  productId: string;
  name: string;
  sizeOptionId?: string;
  sizeName?: string;
  toppingOptionIds?: string[];
  toppings?: Array<{ id: string; name: string }>;
  unitPrice: number;
  quantity: number;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function paymentIdempotencyStorageKey(orderId: string): string {
  return `brewlite_swe_a2_payment_${orderId}`;
}

export function getOrCreateIdempotencyKey(orderId: string): string {
  const keyName = paymentIdempotencyStorageKey(orderId);
  const existing = window.sessionStorage.getItem(keyName);
  if (existing) {
    return existing;
  }
  const fresh = crypto.randomUUID();
  window.sessionStorage.setItem(keyName, fresh);
  return fresh;
}

export function clearStoredIdempotencyKey(orderId: string): void {
  window.sessionStorage.removeItem(paymentIdempotencyStorageKey(orderId));
}

export async function paymentApiRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    token?: string;
    headers?: Record<string, string>;
    body?: string;
    cache?: RequestCache;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers ?? {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body,
    cache: options.cache ?? "no-store",
  });

  if (!response.ok) {
    let errorMessage = "Không thể thực hiện yêu cầu thanh toán.";
    try {
      const payload = (await response.json()) as { message?: string };
      if (typeof payload?.message === "string" && payload.message.trim()) {
        errorMessage = payload.message;
      }
    } catch {
      // Bỏ qua lỗi parse JSON
    }
    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}

export async function startVnpayPayment(
  orderId: string,
  token: string,
  navigate: (url: string) => void = (url) => window.location.assign(url),
): Promise<PaymentAttemptDto> {
  const idempotencyKey = getOrCreateIdempotencyKey(orderId);
  const attempt = await paymentApiRequest<PaymentAttemptDto>("/payments", {
    method: "POST",
    token,
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ orderId }),
  });

  if (attempt.paymentUrl) {
    navigate(attempt.paymentUrl);
  }
  return attempt;
}
