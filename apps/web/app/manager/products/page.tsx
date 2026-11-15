"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import { useAuthSession } from "../../components/auth-session";
import { formatVndPrice } from "../../catalog";
type Product = { id: string; name: string; description: string; basePrice: number; isAvailable: boolean };
type History = { id: string; at: string; actor: string; reason: string; after: Record<string, unknown> };
const empty = { id: "", name: "", description: "", basePrice: 30000, reason: "" };
export default function ProductsAdmin() {
 const {session, ready} = useAuthSession();
 const allowed = ready && session?.user.role === "MANAGER";
 const [products,setProducts] = useState<Product[]>([]);
 const [form,setForm] = useState(empty);
 const [error,setError] = useState("");
 const [notice,setNotice] = useState("");
 const [busy,setBusy] = useState(false);
 const [history,setHistory] = useState<History[] | null>(null);
 useEffect(() => { if (!allowed) return; let active=true; apiFetch<Product[]>("/manager/products").then(rows=>{if(active)setProducts(rows)}).catch(e=>{if(active)setError(e.message)}); return ()=>{active=false}; },[allowed]);
 async function save(event: FormEvent) { event.preventDefault(); setBusy(true);setError("");setNotice(""); try {const {id,...body}=form; await apiFetch(`/manager/products${id?`/${id}`:""}`,{method:id?"PATCH":"POST",body:JSON.stringify(body)});setProducts(await apiFetch<Product[]>("/manager/products"));setForm(empty);setNotice("Đã lưu món và nhật ký thay đổi.");}catch(e){setError(e instanceof Error?e.message:"Không lưu được")}finally{setBusy(false)} }
 async function availability(product: Product) { if(!form.reason.trim()){setError("Điền lý do thay đổi trong biểu mẫu trước khi bật/tắt bán.");return;}setBusy(true);setError("");try{await apiFetch(`/manager/products/${product.id}/availability`,{method:"PATCH",body:JSON.stringify({isAvailable:!product.isAvailable,reason:form.reason})});setProducts(await apiFetch<Product[]>("/manager/products"));setNotice("Đã cập nhật tình trạng bán.");}catch(e){setError(e instanceof Error?e.message:"Không cập nhật được")}finally{setBusy(false)} }
 async function showHistory(id:string){try{setHistory(await apiFetch<History[]>(`/manager/products/${id}/history`));}catch(e){setError(e instanceof Error?e.message:"Không tải được lịch sử")}}
 if(!ready)return <p role="status">Đang tải…</p>;
 if(!allowed)return <section className="state-box">Chỉ tài khoản quản lý được quản lý món. <Link href="/login">Đăng nhập</Link></section>;
 return <section className="customer-page"><span className="eyebrow">QUẢN LÝ THỰC ĐƠN</span><h1>Món & tình trạng bán</h1><p>Món mới tạm ngừng bán. Thiết lập công thức trong <Link href="/staff/inventory">Kho & công thức</Link> trước khi mở bán.</p>{error&&<p role="alert" className="form-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
 <form className="staff-order-card inventory-form" onSubmit={save}><h2>{form.id?"Sửa món":"Thêm món"}</h2><label>Tên món<input required maxLength={100} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Mô tả<textarea maxLength={1000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label>Giá cơ bản (đ)<input type="number" required min={5000} max={100000000} step={1} value={form.basePrice} onChange={e=>setForm({...form,basePrice:Number(e.target.value)})}/></label><label>Lý do thay đổi<input required maxLength={500} value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></label><div className="staff-actions"><button disabled={busy}>Lưu món</button><button type="button" onClick={()=>setForm(empty)}>Nhập món mới</button></div></form>
 <div className="staff-order-list">{products.map(product=><article className="staff-order-card" key={product.id}><h2>{product.name}</h2><p>{product.description}</p><p>{formatVndPrice(product.basePrice)} · {product.isAvailable?"Đang bán":"Tạm ngừng"}</p><div className="staff-actions"><button disabled={busy} onClick={()=>setForm({...product,reason:""})}>Sửa</button><button disabled={busy} onClick={()=>void availability(product)}>{product.isAvailable?"Ngừng bán":"Mở bán"}</button><button onClick={()=>void showHistory(product.id)}>Lịch sử thay đổi</button></div></article>)}</div>
 {history&&<section className="staff-order-card"><h2>Lịch sử thay đổi</h2><button onClick={()=>setHistory(null)}>Đóng lịch sử</button>{history.length===0&&<p>Chưa có thay đổi được ghi nhận.</p>}{history.map(row=><article key={row.id}><p><strong>{row.actor}</strong> · {new Date(row.at).toLocaleString("vi-VN")}</p><p>{row.reason}</p><p>{Object.entries(row.after).map(([key,value])=>`${({name:"Tên",description:"Mô tả",basePrice:"Giá",isAvailable:"Đang bán"} as Record<string,string>)[key]??key}: ${typeof value==="boolean"?(value?"Có":"Không"):String(value)}`).join(" · ")}</p></article>)}</section>}</section>;
}
