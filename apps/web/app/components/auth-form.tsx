"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { apiFetch, type ApiSession } from "../lib/api";
import { useAuthSession } from "./auth-session";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { setSession } = useAuthSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const registering = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const session = await apiFetch<ApiSession>(
        `/auth/${registering ? "register" : "login"}`,
        {
          method: "POST",
          body: JSON.stringify(
            registering ? { name, email, password } : { email, password },
          ),
        },
      );
      setSession(session);
      router.push(registering ? "/cart" : "/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể đăng nhập");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card">
      <span className="eyebrow">BREWLITE ACCOUNT</span>
      <h1>{registering ? "Tạo tài khoản" : "Chào mừng trở lại"}</h1>
      <p className="muted">
        {registering
          ? "Đăng ký để lưu giỏ hàng và theo dõi đơn."
          : "Đăng nhập để tiếp tục đặt món."}
      </p>
      <form className="stack-form" onSubmit={submit}>
        {registering && (
          <label>
            Họ và tên
            <input
              autoComplete="name"
              maxLength={100}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        )}
        <label>
          Email
          <input
            autoComplete="email"
            maxLength={254}
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Mật khẩu
          <input
            autoComplete={registering ? "new-password" : "current-password"}
            minLength={8}
            maxLength={72}
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "Đang xử lý…" : registering ? "Đăng ký" : "Đăng nhập"}
        </button>
      </form>
      <p className="auth-switch">
        {registering ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
        <Link href={registering ? "/login" : "/register"}>
          {registering ? "Đăng nhập" : "Đăng ký"}
        </Link>
      </p>
    </section>
  );
}
