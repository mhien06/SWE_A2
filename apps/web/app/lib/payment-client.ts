import type { ApiSession } from "./api";

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
    pointsBalance?: number;
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

export interface BackendCartItemDto {
  id: string;
  productId: string;
  productName: string;
  productIsAvailable: boolean;
  sizeOptionId: string | null;
  toppingOptionIds: string[];
  selectedSize: string | null;
  selectedToppings: string[];
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface BackendCartDto {
  id: string;
  items: BackendCartItemDto[];
  total: number;
}

export interface OrderQuoteResponseDto {
  subtotal: number;
  discountAmount?: number;
  totalAmount: number;
  pointsRedeemed: number;
  pointsDiscountAmount: number;
  vnpayPayableAmount: number;
}

export interface CreatedOrderResponseDto {
  id?: string;
  orderId?: string;
  orderCode?: string;
  status?: OrderStatus;
  orderStatus?: OrderStatus;
  subtotal?: number;
  discountAmount?: number;
  totalAmount?: number;
  pointsRedeemed?: number;
  pointsDiscountAmount?: number;
  vnpayPayableAmount?: number;
  expiresAt?: string;
  orderExpiresAt?: string;
  items?: OrderItemSnapshot[];
}

export function getPaymentApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3001"
  );
}

export function toClientSession(
  session: ApiSession | ClientSession | null | undefined,
): ClientSession | null {
  if (!session) return null;
  if ("account" in session) {
    return session;
  }
  return {
    accessToken: session.accessToken,
    account: {
      id: session.user.id,
      fullName: session.user.name,
      email: session.user.email,
      role: session.user.role,
      pointsBalance: session.user.pointsBalance,
    },
  };
}

export function mapCartDtoToDrafts(cart: BackendCartDto): CartItemDraft[] {
  return cart.items.map((item) => ({
    key: item.id,
    productId: item.productId,
    name: item.productName,
    sizeOptionId: item.sizeOptionId ?? undefined,
    sizeName: item.selectedSize ?? undefined,
    toppingOptionIds: item.toppingOptionIds,
    toppings: item.selectedToppings.map((name, index) => ({
      id: item.toppingOptionIds[index] ?? `${item.id}-${index}`,
      name,
    })),
    unitPrice: item.unitPrice,
    quantity: item.quantity,
  }));
}

export function normalizeCreatedOrderStatus(
  created: CreatedOrderResponseDto,
): OrderPaymentStatusDto {
  const resolvedOrderId = created.orderId ?? created.id ?? "";
  const total = Number(created.totalAmount ?? created.subtotal ?? 0);
  const payable = Number(created.vnpayPayableAmount ?? total);
  return {
    orderId: resolvedOrderId,
    orderCode: created.orderCode,
    orderStatus: created.orderStatus ?? created.status ?? "PENDING",
    subtotal: Number(created.subtotal ?? total),
    discountAmount: Number(created.discountAmount ?? 0),
    totalAmount: total,
    pointsRedeemed: Number(created.pointsRedeemed ?? 0),
    pointsDiscountAmount: Number(created.pointsDiscountAmount ?? 0),
    vnpayPayableAmount: payable,
    orderExpiresAt:
      created.orderExpiresAt ??
      created.expiresAt ??
      new Date(Date.now() + 15 * 60_000).toISOString(),
    items: created.items,
    payment: null,
    canPay: true,
    canRetry: false,
    needsReview: false,
  };
}

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

  const response = await fetch(`${getPaymentApiBaseUrl()}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body,
    cache: options.cache ?? "no-store",
  });

  if (!response.ok) {
    let errorMessage = "Không thể thực hiện yêu cầu thanh toán.";
    try {
      const payload = (await response.json()) as {
        message?: string | string[];
      };
      if (Array.isArray(payload?.message) && payload.message.length > 0) {
        errorMessage = payload.message.join(", ");
      } else if (
        typeof payload?.message === "string" &&
        payload.message.trim()
      ) {
        errorMessage = payload.message;
      }
    } catch {
      // Ignore JSON parsing failure for non-JSON error payloads
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
