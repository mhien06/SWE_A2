"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, readSession, saveSession, type ApiSession } from "../lib/api";
import { useAuthSession } from "./auth-session";

export default function SiteNavigation() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { session, ready, signOut } = useAuthSession();
  const token = session?.accessToken;
  useEffect(() => {
    if (!token) return;
    let active = true;
    let pending = false;
    async function refresh() {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const user = await apiFetch<ApiSession["user"]>("/auth/me");
        const current = readSession();
        if (active && current && current.accessToken === token && JSON.stringify(current.user) !== JSON.stringify(user)) {
          saveSession({ ...current, user });
        }
      } catch { /* apiFetch handles expired sessions; keep the last known profile on network errors. */ }
      finally { pending = false; }
    }
    void refresh();
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener("brewlite:loyalty-changed", refresh);
    return () => { active = false; clearInterval(interval); window.removeEventListener("focus", refresh); window.removeEventListener("brewlite:loyalty-changed", refresh); };
  }, [token]);

  function logout() {
    setOpen(false);
    signOut();
    router.push("/");
  }

  return (
    <div className="navigation-shell">
      {ready && session && <div className="account-identity"><strong>{session.user.name}</strong><span>{session.user.role === "CUSTOMER" ? "Khách hàng" : session.user.role === "STAFF" ? "Nhân viên" : "Quản lý"}{session.user.role === "CUSTOMER" && <> · <Link href="/loyalty">{session.user.pointsBalance.toLocaleString("vi-VN")} điểm</Link></>}</span></div>}
      <button type="button" className="menu-toggle" aria-expanded={open} aria-controls="primary-navigation" onClick={() => setOpen(!open)}>
        <span aria-hidden="true">{open ? "✕" : "☰"}</span>{" "}
        {open ? "Đóng" : ready && session && session.user.role !== "CUSTOMER" ? "Điều hướng" : "Menu"}
      </button>
    <nav id="primary-navigation" aria-label="Điều hướng chính" className={`site-nav${open ? " is-open" : ""}`} onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(".menu-toggle")?.focus(); } }}>
      {(!ready || !session || session.user.role === "CUSTOMER") && <Link href="/">Thực đơn</Link>}
      {ready && session?.user.role === "MANAGER" && <><Link href="/manager/products">Quản lý món</Link><Link href="/staff/inventory">Kho &amp; công thức</Link></>}
      {ready && session?.user.role === "CUSTOMER" && (
        <>
          <Link href="/cart">Giỏ hàng</Link>
          <Link href="/orders">Đơn hàng</Link>
          <Link href="/loyalty">Điểm BrewLite</Link>
        </>
      )}
      {ready &&
        (session?.user.role === "STAFF" ||
          session?.user.role === "MANAGER") && (
          <Link href="/staff/orders">Vận hành</Link>
        )}
      {ready && session ? (
        <button type="button" className="link-button" onClick={logout}>
          Đăng xuất
        </button>
      ) : (
        <Link className="nav-login" href="/login">Đăng nhập <span aria-hidden="true">↗</span></Link>
      )}
    </nav>
    </div>
  );
}
