"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { formatVndPrice } from "../catalog";
import { useAuthSession } from "../components/auth-session";
import PaymentPanel from "../components/payment-panel";
import type { ApiSession } from "../lib/api";
import {
  mapCartDtoToDrafts,
  normalizeCreatedOrderStatus,
  paymentApiRequest,
  startVnpayPayment,
  toClientSession,
  type BackendCartDto,
  type CartItemDraft,
  type ClientSession,
  type CreatedOrderResponseDto,
  type OrderPaymentStatusDto,
  type OrderQuoteResponseDto,
} from "../lib/payment-client";
import "../payment/payment-theme.css";

export interface CheckoutViewProps {
  initialOrderId?: string | null;
  initialSession?: ApiSession | ClientSession | null;
  initialCart?: CartItemDraft[] | null;
  onClearCart?: () => void;
  onNavigateToGateway?: (url: string) => void;
}

export function CheckoutView({
  initialOrderId = null,
  initialSession = null,
  initialCart = null,
  onClearCart,
  onNavigateToGateway,
}: CheckoutViewProps) {
  const { session: authSession, ready: authReady } = useAuthSession();
  const activeSession =
    toClientSession(initialSession) ?? toClientSession(authSession);
  const authIsReady = Boolean(initialSession) || authReady;

  const [cart, setCart] = useState<CartItemDraft[]>(initialCart ?? []);
  const [cartLoaded, setCartLoaded] = useState(initialCart !== null);
  const [cartError, setCartError] = useState("");
  const [cartReloadCount, setCartReloadCount] = useState(0);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const orderId = initialOrderId ?? createdOrderId;
  const [createdOrder, setCreatedOrder] =
    useState<OrderPaymentStatusDto | null>(null);
  const [pointsInput, setPointsInput] = useState("0");
  const [pointsRedeemed, setPointsRedeemed] = useState(0);
  const [quote, setQuote] = useState<OrderQuoteResponseDto | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submitLockRef = useRef(false);

  const isCustomer =
    Boolean(activeSession) &&
    activeSession?.account.role !== "STAFF" &&
    activeSession?.account.role !== "MANAGER";

  useEffect(() => {
    if (initialCart !== null || orderId || !isCustomer || !activeSession) {
      return;
    }
    let active = true;
    const token = activeSession.accessToken;

    async function fetchCart() {
      try {
        const data = await paymentApiRequest<BackendCartDto>("/cart", {
          token,
          cache: "no-store",
        });
        if (!active) return;
        setCart(mapCartDtoToDrafts(data));
        setCartError("");
      } catch (err) {
        if (!active) return;
        setCartError(
          err instanceof Error
            ? err.message
            : "Không tải được giỏ hàng từ máy chủ.",
        );
      } finally {
        if (active) {
          setCartLoaded(true);
        }
      }
    }

    void fetchCart();
    return () => {
      active = false;
    };
  }, [initialCart, orderId, isCustomer, activeSession, cartReloadCount]);

  const cartLoading =
    initialCart === null &&
    !orderId &&
    isCustomer &&
    !cartLoaded &&
    !cartError;

  if (!activeSession) {
    if (!authIsReady) {
      return (
        <div className="brewlite-payment-scope">
          <div className="inner-page">
            <div className="empty-cart" role="status">
              <p>Đang kiểm tra phiên đăng nhập…</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="brewlite-payment-scope">
        <div className="inner-page">
          <div className="empty-cart">
            <span className="section-kicker">BREWLITE CHECKOUT</span>
            <h1 className="page-title">Đăng nhập để đặt hàng</h1>
            <p className="page-lead">
              BrewLite cần xác thực tài khoản trước khi tạo đơn và thanh toán
              VNPay Sandbox.
            </p>
            <div className="actions-row" style={{ justifyContent: "center" }}>
              <Link
                className="button button-primary"
                href="/login?next=%2Fcheckout"
              >
                Đăng nhập để tiếp tục
              </Link>
              <Link className="button button-outline" href="/register">
                Tạo tài khoản
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (
    activeSession.account.role === "STAFF" ||
    activeSession.account.role === "MANAGER"
  ) {
    return (
      <div className="brewlite-payment-scope">
        <div className="inner-page">
          <div className="empty-cart" role="alert">
            <span className="section-kicker">BREWLITE CHECKOUT</span>
            <h1 className="page-title">Không có quyền truy cập</h1>
            <p className="page-lead">
              Tài khoản nhân viên/quản lý không sử dụng màn hình đặt đơn khách
              hàng.
            </p>
            <div className="actions-row" style={{ justifyContent: "center" }}>
              <Link className="button button-primary" href="/staff/orders">
                Quản lý đơn hàng
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (orderId) {
    return (
      <div className="brewlite-payment-scope">
        <div className="inner-page">
          <div className="checkout-success">
            <span className="section-kicker">BREWLITE CHECKOUT · VNPAY SANDBOX</span>
            <h1 className="page-title">
              Thanh toán đơn hàng
            </h1>
            <p className="checkout-order-reference">Mã đơn: {createdOrder?.orderCode ?? orderId}</p>
            <p className="page-lead">
              Kiểm tra thông tin và hoàn tất thanh toán. Trạng thái đơn hàng sẽ được cập nhật khi giao dịch được xác nhận.
            </p>

            {createdOrder?.items && createdOrder.items.length > 0 && (
              <section
                className="checkout-panel"
                style={{ marginBottom: "18px" }}
              >
                <h2>Sản phẩm trong đơn</h2>
                <div className="checkout-lines">
                  {createdOrder.items.map((item, idx) => (
                    <div
                      key={item.id ?? `${item.productId}-${idx}`}
                      className="checkout-line"
                    >
                      <div>
                        <strong>
                          {item.productNameSnapshot} ×{item.quantity}
                        </strong>
                        {item.selectedSizeSnapshot && (
                          <div className="item-meta">
                            Size {item.selectedSizeSnapshot}
                            {item.selectedToppingsSnapshot?.length
                              ? ` · ${item.selectedToppingsSnapshot.join(", ")}`
                              : ""}
                          </div>
                        )}
                      </div>
                      <strong>{formatVndPrice(item.lineTotal)}</strong>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <PaymentPanel
              orderId={orderId}
              token={activeSession.accessToken}
              onSnapshot={setCreatedOrder}
              onNavigateToGateway={onNavigateToGateway}
            />

            <div className="actions-row">
              <Link className="button button-outline" href="/orders">
                Lịch sử đơn hàng
              </Link>
              <Link className="button button-outline" href="/">
                Quay lại thực đơn
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cartLoading) {
    return (
      <div className="brewlite-payment-scope">
        <div className="inner-page">
          <div className="empty-cart" role="status">
            <p>Đang tải giỏ hàng từ máy chủ BrewLite…</p>
          </div>
        </div>
      </div>
    );
  }

  if (cartError) {
    return (
      <div className="brewlite-payment-scope">
        <div className="inner-page">
          <div className="empty-cart" role="alert">
            <span className="section-kicker">BREWLITE CHECKOUT</span>
            <h1 className="page-title">Không tải được giỏ hàng</h1>
            <p className="error-card">{cartError}</p>
            <div className="actions-row" style={{ justifyContent: "center" }}>
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  setCartLoaded(false);
                  setCartError("");
                  setCartReloadCount((c) => c + 1);
                }}
              >
                Thử tải lại
              </button>
              <Link className="button button-outline" href="/cart">
                Quay lại giỏ hàng
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="brewlite-payment-scope">
        <div className="inner-page">
          <div className="empty-cart">
            <span className="section-kicker">BREWLITE CHECKOUT</span>
            <h1 className="page-title">Chưa có món để đặt</h1>
            <p className="page-lead">
              Hãy chọn đồ uống yêu thích trong thực đơn trước khi thanh toán.
            </p>
            <div className="actions-row" style={{ justifyContent: "center" }}>
              <Link className="button button-primary" href="/cart">
                Xem giỏ hàng
              </Link>
              <Link className="button button-outline" href="/">
                Khám phá thực đơn
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const estimatedTotal = cart.reduce(
    (sum, item) => sum + Number(item.unitPrice) * Number(item.quantity),
    0,
  );
  const totalCups = cart.reduce(
    (sum, item) => sum + Number(item.quantity),
    0,
  );
  const displayedSubtotal = quote?.subtotal ?? estimatedTotal;
  const displayedDiscount = quote?.pointsDiscountAmount ?? 0;
  const displayedPayable = quote?.vnpayPayableAmount ?? estimatedTotal;

  async function handleApplyPoints() {
    if (quoting || !activeSession) return;
    const parsed = Math.max(0, Math.floor(Number(pointsInput) || 0));
    setQuoting(true);
    setError("");
    try {
      const nextQuote = await paymentApiRequest<OrderQuoteResponseDto>(
        "/orders/quote",
        {
          method: "POST",
          token: activeSession.accessToken,
          body: JSON.stringify({ pointsRedeemed: parsed }),
        },
      );
      setQuote(nextQuote);
      setPointsRedeemed(nextQuote.pointsRedeemed);
      setPointsInput(String(nextQuote.pointsRedeemed));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể tính ưu đãi điểm lúc này.",
      );
    } finally {
      setQuoting(false);
    }
  }

  async function handleCreateOrderAndPay() {
    if (submitLockRef.current || submitting || orderId || !activeSession) {
      return;
    }
    submitLockRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const created = await paymentApiRequest<CreatedOrderResponseDto>(
        "/orders",
        {
          method: "POST",
          token: activeSession.accessToken,
          body: JSON.stringify({ pointsRedeemed }),
        },
      );
      const normalized = normalizeCreatedOrderStatus(created);
      if (!normalized.orderId) {
        throw new Error("Máy chủ không trả về mã đơn hàng hợp lệ.");
      }
      setCreatedOrder(normalized);
      setCreatedOrderId(normalized.orderId);
      onClearCart?.();
      await startVnpayPayment(
        normalized.orderId,
        activeSession.accessToken,
        onNavigateToGateway,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể tạo đơn hàng. Vui lòng thử lại.",
      );
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="brewlite-payment-scope">
      <div className="inner-page">
        <span className="section-kicker">BREWLITE CHECKOUT · VNPAY SANDBOX</span>
        <h1 className="page-title">Kiểm tra &amp; xác nhận đơn hàng</h1>
        <p className="page-lead">
          Giá chính thức, điểm quy đổi và tình trạng nguyên liệu được máy chủ
          BrewLite tính toán lại khi tạo đơn.
        </p>

        <div className="cart-layout">
          <section className="checkout-panel">
            <h2>01. Khách hàng</h2>
            <div className="customer-summary">
              <div>
                <strong>{activeSession.account.fullName}</strong>
                <div className="item-meta">{activeSession.account.email}</div>
              </div>
              {typeof activeSession.account.pointsBalance === "number" && (
                <span className="order-status">
                  {activeSession.account.pointsBalance} điểm BrewLite
                </span>
              )}
            </div>

            <h2>02. Món đã chọn ({totalCups} ly)</h2>
            <div className="checkout-lines">
              {cart.map((item) => (
                <div key={item.key} className="checkout-line">
                  <div>
                    <strong>
                      {item.name} ×{item.quantity}
                    </strong>
                    {item.sizeName && (
                      <div className="item-meta">
                        Size {item.sizeName}
                        {item.toppings?.length
                          ? ` · ${item.toppings.map((t) => t.name).join(", ")}`
                          : ""}
                      </div>
                    )}
                  </div>
                  <strong>
                    {formatVndPrice(Number(item.unitPrice) * item.quantity)}
                  </strong>
                </div>
              ))}
            </div>
          </section>

          <aside className="summary-card">
            <h2>Tổng kết thanh toán</h2>
            <div className="summary-rows">
              <div className="summary-row">
                <span>Tạm tính ({totalCups} ly)</span>
                <strong>{formatVndPrice(displayedSubtotal)}</strong>
              </div>
              {displayedDiscount > 0 && (
                <div className="summary-row">
                  <span>Giảm từ điểm BrewLite ({pointsRedeemed} điểm)</span>
                  <strong>-{formatVndPrice(displayedDiscount)}</strong>
                </div>
              )}
              <div className="summary-row summary-total">
                <span>Thanh toán VNPay</span>
                <strong>{formatVndPrice(displayedPayable)}</strong>
              </div>
            </div>

            {(activeSession.account.pointsBalance ?? 0) > 0 && (
              <div className="loyalty-box">
                <label htmlFor="checkout-points-input">
                  Đổi điểm BrewLite (khả dụng:{" "}
                  {activeSession.account.pointsBalance} điểm)
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    id="checkout-points-input"
                    className="loyalty-input"
                    type="number"
                    min={0}
                    max={activeSession.account.pointsBalance}
                    value={pointsInput}
                    onChange={(e) => setPointsInput(e.target.value)}
                  />
                  <button
                    type="button"
                    className="button button-outline"
                    disabled={quoting}
                    onClick={handleApplyPoints}
                  >
                    {quoting ? "Đang tính…" : "Áp dụng"}
                  </button>
                </div>
              </div>
            )}

            <p className="item-meta" style={{ marginTop: "12px" }}>
              Đơn hàng có hiệu lực chờ thanh toán tối đa 15 phút kể từ lúc
              tạo; mỗi lượt giao dịch VNPay Sandbox có thời hạn tối đa 5 phút.
            </p>

            {error && (
              <p className="error-card" role="alert">
                {error}
              </p>
            )}

            <div className="actions-row">
              <button
                type="button"
                className="button button-primary"
                disabled={submitting}
                onClick={handleCreateOrderAndPay}
              >
                {submitting
                  ? "Đang xử lý…"
                  : "Đặt hàng và thanh toán VNPay"}
              </button>
              <Link className="button button-outline" href="/cart">
                Quay lại giỏ hàng
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function CheckoutSearchParamsView() {
  const searchParams = useSearchParams();
  const initialOrderId = searchParams.get("orderId");
  return (
    <CheckoutView
      key={initialOrderId ?? "cart-checkout"}
      initialOrderId={initialOrderId}
    />
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="brewlite-payment-scope">
          <div className="inner-page">
            <div className="empty-cart" role="status">
              <p>Đang tải màn hình thanh toán BrewLite…</p>
            </div>
          </div>
        </div>
      }
    >
      <CheckoutSearchParamsView />
    </Suspense>
  );
}
