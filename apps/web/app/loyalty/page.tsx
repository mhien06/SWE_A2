"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuthSession } from "../components/auth-session";

type Summary = { pointsBalance: number; transactions: Array<{ id: string; type: string; points: number; orderId: string | null; createdAt: string }> };
const labels: Record<string, string> = { EARN: "Tích điểm thanh toán", REDEEM: "Dùng điểm giảm giá", RETURN_REDEEMED: "Hoàn điểm đã dùng", REVERSE_EARNED: "Thu hồi điểm thưởng của đơn hủy", VNPAY_COMPENSATION: "Bù giá trị VNPay bằng điểm", ADJUST: "Điều chỉnh điểm" };

export default function LoyaltyPage() {
  const { session, ready } = useAuthSession();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const token = session?.accessToken;
  const role = session?.user.role;
  useEffect(() => {
    if (!token || role !== "CUSTOMER") return;
    let active = true;
    apiFetch<Summary>("/loyalty").then(result => { if (active) { setData(result); setError(""); window.dispatchEvent(new Event("brewlite:loyalty-changed")); } }).catch(caught => { if (active) setError(caught instanceof Error ? caught.message : "Không tải được điểm"); });
    return () => { active = false; };
  }, [token, role, attempt]);
  if (!ready) return <p role="status">Đang tải tài khoản…</p>;
  if (!session) return <div className="state-box"><Link className="primary-link" href="/login">Đăng nhập để xem điểm</Link></div>;
  if (role !== "CUSTOMER") return <div className="state-box">Điểm BrewLite dành cho tài khoản khách hàng.</div>;
  return <section className="customer-page">
    <span className="eyebrow">BREWLITE REWARDS</span><h1>Điểm BrewLite của bạn</h1>
    <p className="muted">Xin chào {session.user.name}. Theo dõi điểm tích, điểm đã dùng và các khoản hoàn/bù điểm.</p>
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="secondary-button" onClick={() => setAttempt(value => value + 1)}>Cập nhật điểm</button>
    {!data && !error && <p role="status">Đang tải lịch sử điểm…</p>}
    {data && <><div className="loyalty-balance"><span>Số dư hiện tại</span><strong>{data.pointsBalance.toLocaleString("vi-VN")} điểm</strong><Link href="/cart">Dùng điểm trong giỏ hàng →</Link></div>
      <p className="muted">Khi hủy đơn đã thanh toán hợp lệ, tiền VNPay được bù bằng điểm (làm tròn lên 1 điểm / 100đ), không hoàn về ngân hàng. Điểm giảm giá được hoàn riêng; điểm thưởng của đơn hủy được thu hồi.</p>
      <h2 className="loyalty-history-title">100 biến động gần nhất</h2>
      {data.transactions.length === 0 ? <div className="state-box">Chưa có biến động điểm.</div> : <ul className="loyalty-history">{data.transactions.map(item => <li key={item.id}><div><strong>{labels[item.type] ?? item.type}</strong><small>{new Date(item.createdAt).toLocaleString("vi-VN")}</small>{item.orderId && <Link href={`/orders/${item.orderId}`}>Xem đơn liên quan →</Link>}</div><strong className={item.points > 0 ? "points-credit" : "points-debit"}>{item.points > 0 ? "+" : ""}{item.points.toLocaleString("vi-VN")} điểm</strong></li>)}</ul>}
    </>}
  </section>;
}
