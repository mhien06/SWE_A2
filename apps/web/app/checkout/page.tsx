"use client";

import Link from "next/link";
import { useState } from "react";
import { formatVndPrice } from "../catalog";
import PaymentPanel from "../components/payment-panel";
import {
  paymentApiRequest,
  startVnpayPayment,
  type CartItemDraft,
  type ClientSession,
  type OrderPaymentStatusDto,
} from "../lib/payment-client";

export interface CheckoutViewProps {
  initialOrderId?: string | null;
  initialSession?: ClientSession | null;
  initialCart?: CartItemDraft[];
  onClearCart?: () => void;
  onNavigateToGateway?: (url: string) => void;
}

export function CheckoutView({
  initialOrderId = null,
  initialSession = null,
  initialCart = [],
  onClearCart,
  onNavigateToGateway,
}: CheckoutViewProps) {
  const [orderId, setOrderId] = useState<string | null>(initialOrderId);
  const [createdOrder, setCreatedOrder] =
    useState<OrderPaymentStatusDto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (
    initialSession &&
    (initialSession.account.role === "STAFF" ||
      initialSession.account.role === "MANAGER")
  ) {
    return (
      <div className="state-box" role="alert">
        <h2>Không có quyền truy cập</h2>
        <p>Tài khoản nhân viên/quản lý không sử dụng màn hình đặt đơn khách hàng.</p>
        <Link className="back-link" href="/staff/orders">
          Quản lý đơn hàng
        </Link>
      </div>
    );
  }

  if (!initialSession) {
    return (
      <div className="state-box">
        <h1>Đăng nhập để đặt hàng</h1>
        <p>BrewLite cần xác thực tài khoản trước khi tạo đơn và thanh toán VNPay.</p>
        <Link className="back-link" href="/login?next=%2Fcheckout">
          Đăng nhập để tiếp tục
        </Link>
      </div>
    );
  }

  if (orderId) {
    return (
      <div className="checkout-page">
        <span className="eyebrow">BREWLITE CHECKOUT</span>
        <h1>Thanh toán đơn hàng #{createdOrder?.orderCode ?? orderId}</h1>
        <p>
          Số tiền thanh toán được lấy trực tiếp từ máy chủ BrewLite. Kết quả
          chỉ được công nhận sau khi backend xác minh IPN hoặc QueryDR từ VNPay
          Sandbox.
        </p>

        {createdOrder?.items && createdOrder.items.length > 0 && (
          <div
            style={{
              marginTop: "1rem",
              padding: "1rem",
              background: "white",
              border: "1px solid var(--line)",
              borderRadius: "1rem",
            }}
          >
            <h2>Sản phẩm trong đơn</h2>
            {createdOrder.items.map((item, idx) => (
              <div
                key={item.id ?? `${item.productId}-${idx}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: ".5rem 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div>
                  <strong>
                    {item.productNameSnapshot} ×{item.quantity}
                  </strong>
                  {item.selectedSizeSnapshot && (
                    <div style={{ fontSize: ".85rem", color: "var(--muted)" }}>
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
        )}

        <PaymentPanel
          orderId={orderId}
          token={initialSession.accessToken}
          onNavigateToGateway={onNavigateToGateway}
        />
      </div>
    );
  }

  if (initialCart.length === 0) {
    return (
      <div className="state-box">
        <h1>Chưa có món để đặt</h1>
        <p>Hãy chọn đồ uống yêu thích trong thực đơn trước khi thanh toán.</p>
        <Link className="back-link" href="/">
          Khám phá thực đơn
        </Link>
      </div>
    );
  }

  const estimatedTotal = initialCart.reduce(
    (sum, item) => sum + Number(item.unitPrice) * Number(item.quantity),
    0,
  );
  const totalCups = initialCart.reduce(
    (sum, item) => sum + Number(item.quantity),
    0,
  );

  async function handleCreateOrderAndPay() {
    if (submitting || orderId || !initialSession) return;
    setSubmitting(true);
    setError("");
    try {
      const items = initialCart.map((item) => ({
        productId: item.productId,
        sizeOptionId: item.sizeOptionId,
        toppingOptionIds: item.toppingOptionIds ?? [],
        quantity: item.quantity,
      }));
      const order = await paymentApiRequest<OrderPaymentStatusDto>("/orders", {
        method: "POST",
        token: initialSession.accessToken,
        body: JSON.stringify({ items }),
      });
      setCreatedOrder(order);
      setOrderId(order.orderId);
      onClearCart?.();
      await startVnpayPayment(
        order.orderId,
        initialSession.accessToken,
        onNavigateToGateway,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể tạo đơn hàng. Vui lòng thử lại.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="checkout-page">
      <span className="eyebrow">BREWLITE CHECKOUT</span>
      <h1>Kiểm tra đơn hàng</h1>
      <p>
        Giá chính thức, điểm quy đổi và tình trạng nguyên liệu được máy chủ
        BrewLite tính toán lại khi tạo đơn.
      </p>

      <div
        style={{
          display: "grid",
          gap: "1.25rem",
          marginTop: "1.25rem",
        }}
      >
        <section
          style={{
            padding: "1.25rem",
            background: "white",
            border: "1px solid var(--line)",
            borderRadius: "1rem",
          }}
        >
          <h2>01. Khách hàng</h2>
          <p style={{ marginTop: ".35rem" }}>
            <strong>{initialSession.account.fullName}</strong> (
            {initialSession.account.email})
          </p>

          <h2 style={{ marginTop: "1.25rem" }}>
            02. Món đã chọn ({totalCups} ly)
          </h2>
          <div style={{ marginTop: ".5rem" }}>
            {initialCart.map((item) => (
              <div
                key={item.key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: ".6rem 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div>
                  <strong>
                    {item.name} ×{item.quantity}
                  </strong>
                  {item.sizeName && (
                    <div style={{ fontSize: ".85rem", color: "var(--muted)" }}>
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

        <aside
          style={{
            padding: "1.25rem",
            background: "#fffaf4",
            border: "1px solid var(--line)",
            borderRadius: "1rem",
          }}
        >
          <h2>Tổng kết thanh toán</h2>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: ".75rem",
            }}
          >
            <span>Tạm tính tại giỏ (chỉ để tham khảo)</span>
            <strong>{formatVndPrice(estimatedTotal)}</strong>
          </div>
          <p
            style={{
              marginTop: ".75rem",
              fontSize: ".85rem",
              color: "var(--muted)",
            }}
          >
            Đơn hàng có hiệu lực chờ thanh toán tối đa 15 phút kể từ lúc tạo;
            mỗi lượt giao dịch VNPay Sandbox có thời hạn tối đa 5 phút.
          </p>

          {error && (
            <p
              role="alert"
              style={{ marginTop: ".75rem", color: "#b42318", fontWeight: 600 }}
            >
              {error}
            </p>
          )}

          <div style={{ marginTop: "1rem", display: "flex", gap: ".75rem" }}>
            <button
              type="button"
              disabled={submitting}
              onClick={handleCreateOrderAndPay}
            >
              {submitting
                ? "Đang xử lý…"
                : "Đặt hàng và thanh toán VNPay"}
            </button>
            <Link
              className="back-link"
              href="/cart"
              style={{ marginBottom: 0 }}
            >
              Quay lại giỏ hàng
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return <CheckoutView />;
}
