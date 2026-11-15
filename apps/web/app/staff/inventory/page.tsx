"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuthSession } from "../../components/auth-session";
import { apiFetch } from "../../lib/api";

type Ingredient = { id: string; name: string; unit: string; quantityOnHand: string; reorderLevel: string; isActive: boolean };
type Product = { id: string; name: string; options: { id: string; name: string; type: string }[] };
type Recipe = { id: string; productId: string; productOptionId: string | null; version: number; isActive: boolean; createdAt: string; createdBy: { name: string } | null; product: { name: string }; productOption: { name: string } | null; ingredients: { ingredientId: string; quantity: string; unit: string; ingredient: { name: string } }[] };
type Movement = { id: string; type: string; ingredient: string; unit: string; delta: number; at: string; actor: string; reason: string; orderId: string | null };
const units: Record<string, string> = { GRAM: "g", MILLILITER: "ml", UNIT: "đơn vị" };

export default function InventoryPage() {
  const { session, ready } = useAuthSession();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [history, setHistory] = useState<Movement[]>([]);
  const [tab, setTab] = useState("stock");
  const [filter, setFilter] = useState("");
  const [productId, setProductId] = useState("");
  const [optionId, setOptionId] = useState("");
  const [lines, setLines] = useState([{ ingredientId: "", quantity: "" }]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const manager = session?.user.role === "MANAGER";
  const load = useCallback(async () => {
    const [stock, formulas, catalog, movements] = await Promise.all([
      apiFetch<Ingredient[]>("/staff/inventory/ingredients"), apiFetch<Recipe[]>("/staff/inventory/recipes"),
      apiFetch<Product[]>("/staff/inventory/catalog"), apiFetch<Movement[]>(`/staff/inventory/history${filter ? `?ingredientId=${filter}` : ""}`),
    ]);
    return { stock, formulas, catalog, movements };
  }, [filter]);
  const applyData = useCallback((data: { stock: Ingredient[]; formulas: Recipe[]; catalog: Product[]; movements: Movement[] }) => {
    setIngredients(data.stock); setRecipes(data.formulas); setProducts(data.catalog); setHistory(data.movements);
  }, []);
  useEffect(() => {
    if (!manager) return;
    let active = true;
    load().then(data => { if (active) applyData(data); }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [manager, load, applyData]);
  async function submit(event: FormEvent<HTMLFormElement>, path: string, method: string, body: object) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await apiFetch(path, { method, body: JSON.stringify(body) }); setNotice("Đã lưu thành công."); applyData(await load()); }
    catch (err) { setError(err instanceof Error ? err.message : "Không lưu được dữ liệu"); }
    finally { setBusy(false); }
  }
  if (!ready) return <p role="status">Đang kiểm tra tài khoản…</p>;
  if (!session) return <Link className="primary-link" href="/login">Đăng nhập để quản lý kho</Link>;
  if (!manager) return <div className="state-box" role="alert">Chỉ quản lý được truy cập kho và công thức.</div>;
  const selectedProduct = products.find(product => product.id === productId);
  const lowStock = ingredients.filter(item => Number(item.quantityOnHand) <= Number(item.reorderLevel));
  return <section className="customer-page inventory-page">
    <span className="eyebrow">QUẢN LÝ CỬA HÀNG</span><h1>Kho &amp; công thức</h1>
    <p className="muted">{session.user.name} · Tồn kho chỉ bị trừ khi thanh toán được xác nhận.</p>
    <div className="inventory-tabs" aria-label="Các mục quản lý kho">{[["stock", "Nguyên liệu"], ["recipes", "Công thức"], ["history", "Lịch sử kho"]].map(([key, label]) => <button key={key} className={tab === key ? "" : "secondary-button"} aria-pressed={tab === key} onClick={() => setTab(key)}>{label}</button>)}</div>
    {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status" className="loyalty-notice">{notice}</p>}
    <button className="secondary-button" disabled={busy} onClick={() => { setError(""); void load().then(applyData).catch(err => setError(err.message)); }}>Làm mới dữ liệu</button>
    {loading && <p role="status">Đang tải kho…</p>}
    {tab === "stock" && <>
      <div className="loyalty-notice">{ingredients.length} nguyên liệu · {lowStock.length} nguyên liệu chạm hoặc thấp hơn ngưỡng tồn.</div>
      <div className="inventory-grid">{ingredients.map(item => <article className="inventory-card" key={item.id}>
        <h2>{item.name}</h2><p className={Number(item.quantityOnHand) <= Number(item.reorderLevel) ? "form-error" : "points-credit"}><strong>{Number(item.quantityOnHand).toLocaleString("vi-VN")} {units[item.unit]}</strong> · Ngưỡng: {Number(item.reorderLevel).toLocaleString("vi-VN")}</p>
        {!item.isActive && <p>Ngừng sử dụng</p>}
        <form className="stack-form" onSubmit={event => { const form = new FormData(event.currentTarget); void submit(event, `/staff/inventory/ingredients/${item.id}/stock`, "PATCH", { quantityDelta: Number(form.get("delta")), reason: form.get("reason") }); }}>
          <label>Lượng điều chỉnh (+ nhập, − xuất)<input aria-label={`Điều chỉnh ${item.name}`} name="delta" type="number" step="0.001" required /></label>
          <label>Lý do<input name="reason" required maxLength={500} pattern=".*\S.*" /></label><button disabled={busy}>Lưu điều chỉnh</button>
        </form>
      </article>)}</div>
      <details className="inventory-card"><summary>Thêm nguyên liệu</summary><form className="stack-form" onSubmit={event => { const form = new FormData(event.currentTarget); void submit(event, "/staff/inventory/ingredients", "POST", { name: form.get("name"), unit: form.get("unit"), quantityOnHand: Number(form.get("stock")), reorderLevel: Number(form.get("threshold")), ...(form.get("reason") ? { reason: form.get("reason") } : {}) }); }}>
        <label>Tên<input name="name" required maxLength={100} /></label><label>Đơn vị<select name="unit"><option value="GRAM">Gram</option><option value="MILLILITER">Mililít</option><option value="UNIT">Đơn vị</option></select></label>
        <label>Tồn ban đầu<input name="stock" type="number" min="0" step="0.001" defaultValue="0" required /></label><label>Ngưỡng tồn thấp<input name="threshold" type="number" min="0" step="0.001" defaultValue="0" required /></label><label>Lý do nhập ban đầu (bắt buộc nếu tồn lớn hơn 0)<input name="reason" maxLength={500} /></label><button disabled={busy}>Tạo nguyên liệu</button>
      </form></details>
    </>}
    {tab === "recipes" && <>
      <form className="inventory-card stack-form" onSubmit={event => void submit(event, "/staff/inventory/recipes", "POST", { productId, ...(optionId ? { productOptionId: optionId } : {}), ingredients: lines.map(line => ({ ingredientId: line.ingredientId, quantity: Number(line.quantity) })) })}>
        <h2>Tạo phiên bản công thức mới</h2><p className="muted">Công thức nền dùng cho size S. Size khác và topping cần công thức bổ sung. Phiên bản cũ được giữ để tra cứu.</p>
        <label>Món<select required value={productId} onChange={event => { setProductId(event.target.value); setOptionId(""); }}><option value="">Chọn món</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        <label>Áp dụng<select value={optionId} onChange={event => setOptionId(event.target.value)}><option value="">Công thức nền</option>{selectedProduct?.options.map(option => <option key={option.id} value={option.id}>{option.type === "SIZE" ? "Size" : "Topping"} {option.name}</option>)}</select></label>
        {lines.map((line, index) => <div className="recipe-line" key={index}><label>Nguyên liệu<select required value={line.ingredientId} onChange={event => setLines(current => current.map((value, i) => i === index ? { ...value, ingredientId: event.target.value } : value))}><option value="">Chọn nguyên liệu</option>{ingredients.filter(item => item.isActive).map(item => <option key={item.id} value={item.id}>{item.name} ({units[item.unit]})</option>)}</select></label><label>Định lượng<input required min="0.001" step="0.001" type="number" value={line.quantity} onChange={event => setLines(current => current.map((value, i) => i === index ? { ...value, quantity: event.target.value } : value))} /></label><button type="button" className="secondary-button" disabled={lines.length === 1} onClick={() => setLines(current => current.filter((_, i) => i !== index))}>Xóa dòng</button></div>)}
        <button type="button" className="secondary-button" onClick={() => setLines(current => [...current, { ingredientId: "", quantity: "" }])}>Thêm dòng</button><button disabled={busy}>Lưu phiên bản mới</button>
      </form>
      <h2>Các phiên bản công thức</h2><div className="inventory-grid">{recipes.map(recipe => <article className="inventory-card" key={recipe.id}><h3>{recipe.product.name} · {recipe.productOption?.name ?? "Nền"}</h3><p>v{recipe.version} · {recipe.isActive ? "Đang áp dụng" : "Lưu trữ"}</p><p className="muted">{recipe.createdBy?.name ?? "Dữ liệu cũ / seed"} · {new Date(recipe.createdAt).toLocaleString("vi-VN")}</p><ul>{recipe.ingredients.map(line => <li key={line.ingredientId}>{line.ingredient.name}: {Number(line.quantity)} {units[line.unit]}</li>)}</ul><button className="secondary-button" onClick={() => { setProductId(recipe.productId); setOptionId(recipe.productOptionId ?? ""); setLines(recipe.ingredients.map(line => ({ ingredientId: line.ingredientId, quantity: String(line.quantity) }))); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Dùng làm mẫu chỉnh sửa</button></article>)}</div>
    </>}
    {tab === "history" && <><label className="stack-form">Lọc nguyên liệu<select value={filter} onChange={event => setFilter(event.target.value)}><option value="">Tất cả</option>{ingredients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><h2>100 biến động gần nhất</h2><ul className="loyalty-history">{history.map(row => <li key={row.id}><div><strong>{row.ingredient} · {row.type === "DEDUCT" ? "Trừ theo đơn" : row.type === "RESTORE" ? "Hoàn kho" : "Điều chỉnh"}</strong><span>{row.reason}</span><small>{row.actor} · {new Date(row.at).toLocaleString("vi-VN")}</small>{row.orderId && <small>Mã đơn: {row.orderId}</small>}</div><strong className={row.delta > 0 ? "points-credit" : "points-debit"}>{row.delta > 0 ? "+" : ""}{row.delta} {units[row.unit]}</strong></li>)}</ul>{history.length === 0 && <p className="state-box">Chưa có biến động kho.</p>}</>}
  </section>;
}
