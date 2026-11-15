"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatVndPrice } from "../catalog";
import { apiFetch } from "../lib/api";
import { useAuthSession } from "./auth-session";

type StaffOrder = {
  id: string;
  orderCode: string;
  status: string;
  createdAt: string;
  vnpayPayableAmount: number;
  user: { name: string; email: string };
  items: Array<{
    id: string;
    productNameSnapshot: string;
    selectedSizeSnapshot: string;
    quantity: number;
  }>;
};

const nextStatus: Record<string, string> = {
  PAID: "PREPARING",
  PREPARING: "READY_FOR_PICKUP",
  READY_FOR_PICKUP: "COMPLETED",
};

export default function StaffOrdersPage() {
  const { session, ready } = useAuthSession();
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      setOrders(await apiFetch<StaffOrder[]>("/staff/orders"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được danh sách đơn");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready || !session) return;
    let active = true;
    apiFetch<StaffOrder[]>("/staff/orders")
      .then((result) => {
        if (active) setOrders(result);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Không tải được danh sách đơn");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ready, session]);

  async function changeStatus(order: StaffOrder) {
    const status = nextStatus[order.status];
    if (!status) return;
    setBusyId(order.id);
    setError("");
    try {
      await apiFetch(`/staff/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadOrders();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không cập nhật được trạng thái");
    } finally {
      setBusyId("");
    }
  }

  async function cancelOrder(order: StaffOrder) {
    const reason = reasons[order.id]?.trim();
    if (!reason) {
      setError("Nhập lý do trước khi hủy đơn đã thanh toán.");
      return;
    }
    setBusyId(order.id);
    setError("");
    try {
      await apiFetch(`/staff/orders/${order.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      await loadOrders();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể hủy đơn");
    } finally {
      setBusyId("");
    }
  }

  if (!ready) {
    return <div className="state-box" role="status">Đang tải đơn vận hành…</div>;
  }
  if (!session) {
    return (
      <div className="state-box">
        <p>Đăng nhập bằng tài khoản nhân viên để tiếp tục.</p>
        <Link className="primary-link" href="/login">Đăng nhập</Link>
      </div>
    );
  }
  if (session.user.role !== "STAFF" && session.user.role !== "MANAGER") {
    return <div className="state-box" role="alert">Tài khoản không có quyền vận hành.</div>;
  }
  if (loading) {
    return <div className="state-box" role="status">Đang tải đơn vận hành…</div>;
  }

  return (
    <section className="customer-page">
      <span className="eyebrow">STAFF OPERATIONS</span>
      <h1>Đơn cần xử lý</h1>
      <p className="muted">Trạng thái chỉ được cập nhật khi backend xác nhận chuyển bước hợp lệ.</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      {orders.length === 0 ? (
        <div className="state-box">Hiện không có đơn cần xử lý.</div>
      ) : (
        <div className="staff-order-list">
          {orders.map((order) => (
            <article className="staff-order-card" key={order.id}>
              <div className="cart-item-heading">
                <div>
                  <span className="eyebrow">{order.orderCode}</span>
                  <h2>{order.status}</h2>
                  <p>{order.user.name} · {order.user.email}</p>
                </div>
                <strong>{formatVndPrice(order.vnpayPayableAmount)}</strong>
              </div>
              <ul>
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.productNameSnapshot} · {item.selectedSizeSnapshot} × {item.quantity}
                  </li>
                ))}
              </ul>
              {order.status === "PAYMENT_EXCEPTION" ? (
                <p className="form-error">Đơn cần đối soát thanh toán/nguyên liệu; không thể bắt đầu pha.</p>
              ) : (
                <div className="staff-actions">
                  {nextStatus[order.status] && (
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => void changeStatus(order)}
                    >
                      {busyId === order.id
                        ? "Đang cập nhật…"
                        : `Chuyển sang ${nextStatus[order.status]}`}
                    </button>
                  )}
                  {order.status === "PAID" && (
                    <div className="staff-cancel">
                      <label>
                        Lý do hủy
                        <input
                          maxLength={500}
                          value={reasons[order.id] ?? ""}
                          onChange={(event) =>
                            setReasons((current) => ({
                              ...current,
                              [order.id]: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="danger-button"
                        disabled={busyId === order.id || !reasons[order.id]?.trim()}
                        onClick={() => void cancelOrder(order)}
                      >
                        Hủy đơn đã thanh toán
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
