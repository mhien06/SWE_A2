"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatVndPrice } from "../catalog";
import { apiFetch } from "../lib/api";
import { useAuthSession } from "./auth-session";

type Order = {
  id: string;
  orderCode: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  totalAmount: number;
  pointsRedeemed: number;
  pointsDiscountAmount: number;
  vnpayPayableAmount: number;
  items: Array<{
    id: string;
    productNameSnapshot: string;
    selectedSizeSnapshot: string;
    selectedToppingsSnapshot: string[];
    quantity: number;
    lineTotal: number;
  }>;
  payments?: Array<{ id: string; status: string }>;
};

const orderStatusLabel: Record<string, string> = {
  PENDING: "Chờ thanh toán",
  PAYMENT_FAILED: "Thanh toán thất bại",
  PAYMENT_EXCEPTION: "Cần nhân viên hỗ trợ",
  PAID: "Đã thanh toán",
  PREPARING: "Đang pha chế",
  READY_FOR_PICKUP: "Sẵn sàng nhận",
  COMPLETED: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
};

export default function OrdersPage({ orderId }: { orderId?: string }) {
  const { session, ready } = useAuthSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !session) return;
    let active = true;
    const path = orderId ? `/orders/${orderId}` : "/orders";
    apiFetch<Order | Order[]>(path)
      .then((result) => {
        if (!active) return;
        if (Array.isArray(result)) setOrders(result);
        else setOrder(result);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Không tải được đơn hàng");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId, ready, session]);

  async function cancel() {
    if (!order) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/orders/${order.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setOrder({ ...order, status: "CANCELLED" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể hủy đơn");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <div className="state-box" role="status">Đang tải đơn hàng…</div>;
  }
  if (!session) {
    return (
      <div className="state-box">
        <p>Đăng nhập để xem đơn hàng.</p>
        <Link className="primary-link" href="/login">Đăng nhập</Link>
      </div>
    );
  }
  if (loading) {
    return <div className="state-box" role="status">Đang tải đơn hàng…</div>;
  }

  if (orderId) {
    return (
      <section className="customer-page">
        <Link className="back-link" href="/orders">← Đơn hàng</Link>
        {error && <p role="alert" className="form-error">{error}</p>}
        {!order ? (
          <div className="state-box">Không tìm thấy đơn hàng.</div>
        ) : (
          <article className="order-detail-card">
            <span className="eyebrow">{order.orderCode}</span>
            <h1>{orderStatusLabel[order.status] ?? order.status}</h1>
            <p>Mã đơn: {order.id}</p>
            <p>Tạo lúc: {new Date(order.createdAt).toLocaleString("vi-VN")}</p>
            {order.status === "PENDING" && (
              <p>Hạn thanh toán: {new Date(order.expiresAt).toLocaleString("vi-VN")}</p>
            )}
            {order.payments?.[0] && (
              <p>Trạng thái thanh toán: {order.payments[0].status}</p>
            )}
            <ul className="order-item-list">
              {order.items.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.productNameSnapshot} · {item.selectedSizeSnapshot}
                    {item.selectedToppingsSnapshot.length > 0 &&
                      ` · ${item.selectedToppingsSnapshot.join(", ")}`}{" "}
                    × {item.quantity}
                  </span>
                  <strong>{formatVndPrice(item.lineTotal)}</strong>
                </li>
              ))}
            </ul>
            <div className="quote-details">
              <p>Tổng đơn <strong>{formatVndPrice(order.totalAmount)}</strong></p>
              {order.pointsRedeemed > 0 && (
                <>
                  <p>Điểm đã dùng: {order.pointsRedeemed}</p>
                  <p>Giảm bằng điểm <strong>{formatVndPrice(order.pointsDiscountAmount)}</strong></p>
                </>
              )}
              <p>VNPay phải trả <strong>{formatVndPrice(order.vnpayPayableAmount)}</strong></p>
            </div>
            {order.status === "PENDING" || order.status === "PAYMENT_FAILED" ? (
              <Link
                className="primary-link"
                href={`/checkout?orderId=${encodeURIComponent(order.id)}`}
              >
                Tiếp tục thanh toán
              </Link>
            ) : null}
            {["PENDING", "PAYMENT_FAILED", "PAID"].includes(order.status) && (
              <button type="button" className="secondary-button" disabled={busy} onClick={() => void cancel()}>
                {busy ? "Đang hủy…" : "Hủy đơn"}
              </button>
            )}
          </article>
        )}
      </section>
    );
  }

  return (
    <section className="customer-page">
      <span className="eyebrow">ORDER HISTORY</span>
      <h1>Đơn hàng của tôi</h1>
      {error && <p role="alert" className="form-error">{error}</p>}
      {orders.length === 0 ? (
        <div className="state-box">
          <p>Bạn chưa có đơn hàng nào.</p>
          <Link className="primary-link" href="/">Xem thực đơn</Link>
        </div>
      ) : (
        <div className="order-list">
          {orders.map((item) => (
            <Link className="order-list-item" href={`/orders/${item.id}`} key={item.id}>
              <span>
                <strong>{item.orderCode}</strong>
                <small>{new Date(item.createdAt).toLocaleString("vi-VN")}</small>
              </span>
              <span>{orderStatusLabel[item.status] ?? item.status}</span>
              <strong>{formatVndPrice(item.vnpayPayableAmount)}</strong>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
