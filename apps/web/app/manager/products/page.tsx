"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatVndPrice } from "../../catalog";
import { useAuthSession } from "../../components/auth-session";
import { apiFetch } from "../../lib/api";

type Product = { id: string; name: string; description: string; basePrice: number; isAvailable: boolean };
type History = { id: string; at: string; actor: string; reason: string; after: Record<string, unknown> };
const empty = { id: "", name: "", description: "", basePrice: 30000, reason: "" };

export default function ProductsAdmin() {
  const { session, ready } = useAuthSession();
  const allowed = ready && session?.user.role === "MANAGER";
  const editorRef = useRef<HTMLFormElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(empty);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Record<string, History[]>>({});
  const [openHistory, setOpenHistory] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadProducts() { setProducts(await apiFetch<Product[]>("/manager/products")); }

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    apiFetch<Product[]>("/manager/products")
      .then((rows) => { if (active) setProducts(rows); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Không tải được danh sách món"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed]);

  function edit(product: Product) {
    setForm({ ...product, reason: "" }); setError(""); setNotice(`Đang sửa món ${product.name}.`);
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusyAction("save"); setError(""); setNotice("");
    try {
      const { id, ...body } = form;
      await apiFetch(`/manager/products${id ? `/${id}` : ""}`, { method: id ? "PATCH" : "POST", body: JSON.stringify(body) });
      await loadProducts(); setForm(empty); setNotice("Đã lưu món và ghi nhật ký thay đổi.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không lưu được món"); }
    finally { setBusyAction(""); }
  }

  async function availability(product: Product) {
    const reason = reasons[product.id]?.trim();
    if (!reason) { setError(`Nhập lý do ngay tại món “${product.name}” trước khi ${product.isAvailable ? "ngừng" : "mở"} bán.`); return; }
    setBusyAction(`availability:${product.id}`); setError(""); setNotice("");
    try {
      await apiFetch(`/manager/products/${product.id}/availability`, { method: "PATCH", body: JSON.stringify({ isAvailable: !product.isAvailable, reason }) });
      await loadProducts(); setReasons((current) => ({ ...current, [product.id]: "" })); setNotice(`Đã ${product.isAvailable ? "ngừng" : "mở"} bán ${product.name}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không cập nhật được tình trạng bán"); }
    finally { setBusyAction(""); }
  }

  async function showHistory(product: Product) {
    if (openHistory === product.id) { setOpenHistory(""); return; }
    setBusyAction(`history:${product.id}`); setError("");
    try {
      const rows = await apiFetch<History[]>(`/manager/products/${product.id}/history`);
      setHistory((current) => ({ ...current, [product.id]: rows })); setOpenHistory(product.id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không tải được lịch sử"); }
    finally { setBusyAction(""); }
  }

  if (!ready) return <p role="status">Đang tải…</p>;
  if (!allowed) return <section className="state-box">Chỉ tài khoản quản lý được quản lý món. <Link href="/login">Đăng nhập</Link></section>;

  return <section className="customer-page operations-page">
    <div className="operations-heading"><div><span className="eyebrow">QUẢN LÝ THỰC ĐƠN</span><h1>Món &amp; tình trạng bán</h1><p className="muted">Cập nhật giá, nội dung và tình trạng phục vụ của từng món.</p></div><div className="operations-metric"><strong>{products.length}</strong><span>món trong hệ thống</span></div></div>
    {error && <p role="alert" className="form-error feedback-banner">{error}</p>}{notice && <p role="status" className="success-banner">{notice}</p>}
    <form ref={editorRef} className="operations-panel inventory-form product-editor" onSubmit={save}>
      <div className="panel-heading"><div><span className="eyebrow">PRODUCT EDITOR</span><h2>{form.id ? `Sửa ${form.name}` : "Thêm món mới"}</h2></div>{form.id && <button type="button" className="text-button" onClick={() => setForm(empty)}>Hủy sửa</button>}</div>
      <div className="form-grid"><label>Tên món<input required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Giá cơ bản (đ)<input type="number" required min={5000} max={100000000} step={1} value={form.basePrice} onChange={(event) => setForm({ ...form, basePrice: Number(event.target.value) })} /></label><label className="wide-field">Mô tả<textarea maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className="wide-field">Lý do thay đổi<input required maxLength={500} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label></div>
      <div className="staff-actions"><button disabled={busyAction === "save"}>{busyAction === "save" ? "Đang lưu…" : form.id ? "Lưu thay đổi" : "Tạo món"}</button><button type="button" className="secondary-button" onClick={() => setForm(empty)}>Nhập món mới</button></div>
    </form>
    <div className="section-heading"><div><span className="eyebrow">CATALOG</span><h2>Danh sách món</h2></div><button type="button" className="secondary-button" disabled={busyAction === "refresh"} onClick={() => { setBusyAction("refresh"); setError(""); void loadProducts().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Không tải lại được")).finally(() => setBusyAction("")); }}>Làm mới</button></div>
    {loading ? <div className="state-box" role="status">Đang tải danh sách món…</div> : <div className="manager-product-grid">{products.map((product) => {
      const availabilityBusy = busyAction === `availability:${product.id}`; const historyBusy = busyAction === `history:${product.id}`; const rows = history[product.id] ?? [];
      return <article className="manager-product-card" key={product.id}><div className="product-card-top"><span className={`status-pill ${product.isAvailable ? "is-active" : "is-paused"}`}>{product.isAvailable ? "Đang bán" : "Tạm ngừng"}</span><strong>{formatVndPrice(product.basePrice)}</strong></div><h3>{product.name}</h3><p className="muted">{product.description || "Chưa có mô tả."}</p><div className="card-action-row"><button type="button" onClick={() => edit(product)}>Sửa món</button><button type="button" className="secondary-button" disabled={historyBusy} onClick={() => void showHistory(product)}>{historyBusy ? "Đang tải…" : openHistory === product.id ? "Đóng lịch sử" : "Xem lịch sử"}</button></div><div className="availability-action"><label htmlFor={`reason-${product.id}`}>Lý do {product.isAvailable ? "ngừng" : "mở"} bán<input id={`reason-${product.id}`} maxLength={500} value={reasons[product.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [product.id]: event.target.value }))} placeholder="Ví dụ: hết nguyên liệu" /></label><button type="button" className={product.isAvailable ? "danger-button" : ""} disabled={availabilityBusy || !reasons[product.id]?.trim()} onClick={() => void availability(product)}>{availabilityBusy ? "Đang cập nhật…" : product.isAvailable ? "Ngừng bán" : "Mở bán"}</button></div>{openHistory === product.id && <div className="inline-history"><h4>Lịch sử thay đổi</h4>{rows.length === 0 ? <p className="muted">Chưa có thay đổi được ghi nhận.</p> : rows.map((row) => <div className="history-entry" key={row.id}><strong>{row.actor}</strong><small>{new Date(row.at).toLocaleString("vi-VN")}</small><p>{row.reason}</p></div>)}</div>}</article>;
    })}</div>}
  </section>;
}
