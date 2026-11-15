"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthSession } from "./auth-session";

export default function SiteNavigation() {
  const router = useRouter();
  const { session, ready, signOut } = useAuthSession();

  function logout() {
    signOut();
    router.push("/");
  }

  return (
    <nav aria-label="Điều hướng chính" className="site-nav">
      <Link href="/">Thực đơn</Link>
      {ready && session?.user.role === "CUSTOMER" && (
        <>
          <Link href="/cart">Giỏ hàng</Link>
          <Link href="/orders">Đơn hàng</Link>
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
        <Link href="/login">Đăng nhập</Link>
      )}
    </nav>
  );
}
