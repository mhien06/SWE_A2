"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuthSession } from "./auth-session";

export function roleHome(role: "CUSTOMER" | "STAFF" | "MANAGER") {
  if (role === "STAFF") return "/staff/orders";
  if (role === "MANAGER") return "/manager/products";
  return "/";
}

export default function CustomerMenuGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { session, ready } = useAuthSession();
  const blocked = ready && !!session && session.user.role !== "CUSTOMER";

  useEffect(() => {
    if (blocked && session) router.replace(roleHome(session.user.role));
  }, [blocked, router, session]);

  if (!ready || blocked) {
    return <div className="state-box" role="status">Đang mở trang làm việc phù hợp…</div>;
  }

  return children;
}
