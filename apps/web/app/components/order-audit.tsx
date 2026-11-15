"use client";
import { useState } from "react";
import { apiFetch } from "../lib/api";
import { formatVndPrice } from "../catalog";
type Audit = {
 items: {productNameSnapshot:string;ingredientUsages:{id:string;ingredientId:string;quantityDeducted:string;ingredientNameSnapshot:string;unitSnapshot:string;deductedAt:string;restoredAt:string|null}[]}[];
 statusChanges: {id:string;actor:string;fromStatus:string;toStatus:string;createdAt:string}[];
 cancellation: null | {reason:string|null;cancelledAt:string;cancelledBy:{name:string}};
 payments: {id:string;status:string;amount:number;createdAt:string;transactionRef:string;reviewRequired:boolean;refundRecords:{id:string;status:string;amount:number;requestedAt:string}[]}[];
 paymentEvents: {id:string;eventType:string;source:string;createdAt:string;paymentId:string|null}[];
 loyaltyTransactions: {id:string;type:string;points:number;createdAt:string}[];
};
const date = (value:string)=>new Date(value).toLocaleString("vi-VN");
export default function OrderAudit({orderId}:{orderId:string}) {
 const [notice,setNotice]=useState("");
 const [filter,setFilter]=useState("");
 const [data,setData]=useState<Audit|null>(null);const [error,setError]=useState("");const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);
 async function load(){setBusy(true);setError("");try{setData(await apiFetch<Audit>(`/staff/orders/${orderId}/audit`));setOpen(true)}catch(e){setError(e instanceof Error?e.message:"Không tải được nhật ký")}finally{setBusy(false)}}
 async function retry(){setBusy(true);setError("");try{const result=await apiFetch<{message:string}>(`/staff/orders/${orderId}/reconcile`,{method:"POST"});setNotice(result.message);await load();}catch(e){setError(e instanceof Error?e.message:"Không đối soát được")}finally{setBusy(false)}}
 return <div className="order-audit"><button disabled={busy} onClick={()=>open?setOpen(false):void load()}>{busy?"Đang tải…":open?"Đóng nhật ký":"Xem nhật ký đơn"}</button>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{open&&data&&<div>{data.payments.some(p=>p.reviewRequired&&["PENDING","UNKNOWN"].includes(p.status))&&<button disabled={busy} onClick={()=>void retry()}>Yêu cầu đối soát VNPay lại</button>}<h3>Lịch sử xử lý</h3>{data.statusChanges.length===0&&<p>Chưa có chuyển bước được ghi nhận.</p>}{data.statusChanges.map(row=><p key={row.id}>{date(row.createdAt)} · {row.actor}: {row.fromStatus} → {row.toStatus}</p>)}{data.cancellation&&<p>Hủy lúc {date(data.cancellation.cancelledAt)} · {data.cancellation.cancelledBy.name} · {data.cancellation.reason??"Khách hàng yêu cầu hủy"}</p>}<h3>Các lượt thanh toán</h3>{data.payments.map(row=><p key={row.id}>{date(row.createdAt)} · {formatVndPrice(row.amount)} · {row.status} {row.reviewRequired&&"· Cần đối soát"}<br/>Mã giao dịch: {row.transactionRef}</p>)}<h3>Biến động điểm</h3>{data.loyaltyTransactions.map(row=><p key={row.id}>{date(row.createdAt)} · {row.type} · {row.points>0?"+":""}{row.points} điểm</p>)}<h3>Nguyên liệu đã sử dụng</h3>{data.items.flatMap(item=>item.ingredientUsages.map(row=><p key={row.id}>{item.productNameSnapshot} · {row.ingredientNameSnapshot} · {row.quantityDeducted} {row.unitSnapshot} · {row.restoredAt?`Đã hoàn: ${date(row.restoredAt)}`:"Đã trừ kho"}</p>))}<h3>Hoàn tiền VNPay cũ</h3>{data.payments.flatMap(payment=>payment.refundRecords.map(row=><p key={row.id}>{date(row.requestedAt)} · {formatVndPrice(row.amount)} · {row.status}</p>))}<h3>Sự kiện thanh toán</h3><label>Lọc theo mã giao dịch, loại hoặc ngày<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Nhập mã, loại sự kiện hoặc ngày"/></label>{data.paymentEvents.filter(row=>`${row.paymentId} ${row.eventType} ${row.source} ${date(row.createdAt)}`.toLowerCase().includes(filter.toLowerCase())).map(row=><p key={row.id}>{date(row.createdAt)} · {row.eventType} · {row.source}<br/>Lượt thanh toán: {row.paymentId??"—"}</p>)}</div>}</div>;
}
