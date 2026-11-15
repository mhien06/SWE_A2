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
  payments?: Array<{ id: string; status: string; amount?: number; createdAt?: string; verifiedAt?: string }>;
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
      const result = await apiFetch<{pendingCancellation?:boolean;message?:string}>(`/orders/${order.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (result.pendingCancellation) {setError(result.message ?? "Đang đối soát thanh toán, đơn chưa hủy.");return;}
      setOrder({ ...order, status: "CANCELLED" });
      setOrder(await apiFetch<Order>(`/orders/${order.id}`));
      window.dispatchEvent(new Event("brewlite:loyalty-changed"));
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

  const paid = order?.payments?.some(payment => payment.status === "SUCCEEDED") ?? false;
  const unverified = order?.payments?.some(payment => ["PENDING", "UNKNOWN"].includes(payment.status)) ?? false;

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
            {order.vnpayPayableAmount === 0 && order.pointsRedeemed > 0 && <p>Phương thức: thanh toán hoàn toàn bằng điểm BrewLite.</p>}
            <p>Khách hàng: <strong>{session.user.name}</strong></p>
            {order.status === "CANCELLED" && <div className="loyalty-notice">
              <p>{paid ? "Đơn đã hủy sau khi thanh toán. Xem lịch sử điểm để kiểm tra kết quả điều chỉnh." : unverified ? "Đơn đã hủy. Giao dịch VNPay đang được xác minh; chưa xác nhận tiền đã thu hoặc điểm bù." : "Đơn đã hủy, chưa thanh toán VNPay. Không có tiền VNPay để hoàn hoặc bù điểm."}</p>
              {(paid || order.pointsRedeemed > 0) && <Link href="/loyalty">{paid ? "Xem lịch sử điều chỉnh điểm →" : "Xem lịch sử hoàn điểm đã dùng →"}</Link>}
            </div>}
            <p>Mã đơn: {order.id}</p>
            <p>Tạo lúc: {new Date(order.createdAt).toLocaleString("vi-VN")}</p>
            {order.status === "PENDING" && (
              <p>Hạn thanh toán: {new Date(order.expiresAt).toLocaleString("vi-VN")}</p>
            )}
            {order.payments?.[0] && (
              <p>Trạng thái thanh toán: {order.payments[0].status}</p>
            )}
            {!!order.payments?.length && <details className="order-audit"><summary>Lịch sử các lượt thanh toán ({order.payments.length})</summary>{order.payments.map(payment=><p key={payment.id}>{payment.createdAt && new Date(payment.createdAt).toLocaleString("vi-VN")} · {({SUCCEEDED:"Thành công",FAILED:"Thất bại",PENDING:"Đang chờ",EXPIRED:"Hết hạn",UNKNOWN:"Đang xác minh"} as Record<string,string>)[payment.status] ?? payment.status}{payment.amount!==undefined && ` · ${formatVndPrice(payment.amount)}`}</p>)}</details>}
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
              <p>{order.status === "CANCELLED" ? "Giá trị đơn trước khi hủy" : "Tổng đơn"} <strong>{formatVndPrice(order.totalAmount)}</strong></p>
              {order.pointsRedeemed > 0 && (
                <>
                  <p>Điểm đã dùng: {order.pointsRedeemed}</p>
                  <p>Giảm bằng điểm <strong>{formatVndPrice(order.pointsDiscountAmount)}</strong></p>
                </>
              )}
              {order.status === "CANCELLED" ? <>
                <p>Còn phải thanh toán <strong>{formatVndPrice(0)}</strong></p>
                {paid && <p>VNPay đã thanh toán <strong>{formatVndPrice(order.payments!.filter(payment => payment.status === "SUCCEEDED").reduce((sum, payment) => sum + (payment.amount ?? 0), 0))}</strong></p>}
              </> : <p>{paid ? "VNPay đã thanh toán" : "VNPay phải trả"} <strong>{formatVndPrice(order.vnpayPayableAmount)}</strong></p>}
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
              <div>
              {order.status === "PAID" && order.vnpayPayableAmount > 0 && <p className="loyalty-notice">Hủy trước khi pha: hoàn điểm đã dùng, thu hồi điểm thưởng và bù tiền VNPay bằng điểm BrewLite (1 điểm / 100đ, làm tròn lên), sau khi kiểm tra không trùng hoàn tiền.</p>}
              <button type="button" className="secondary-button" disabled={busy} onClick={() => void cancel()}>
                {busy ? "Đang hủy…" : "Hủy đơn"}
              </button>
              </div>
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
