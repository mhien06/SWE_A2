"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatVndPrice, productImage } from "../catalog";
import { apiFetch } from "../lib/api";
import { useAuthSession } from "./auth-session";

type CartOption = { id: string; name: string; additionalPrice: number };
type CartItem = {
  id: string;
  productId: string;
  productName: string;
  productIsAvailable: boolean;
  sizeOptionId: string | null;
  toppingOptionIds: string[];
  selectedSize: string;
  selectedToppings: string[];
  availableSizes: CartOption[];
  availableToppings: CartOption[];
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};
type Cart = { id: string; items: CartItem[]; total: number };
type Quote = {
  subtotal: number;
  pointsRedeemed: number;
  pointsDiscountAmount: number;
  vnpayPayableAmount: number;
};

export default function CartPage() {
  const router = useRouter();
  const { session, ready } = useAuthSession();
  const [cart, setCart] = useState<Cart | null>(null);
  const [pointsInput, setPointsInput] = useState("0");
  const [rate, setRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(true);
  const [rateError, setRateError] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ready || !session) return;
    let active = true;
    apiFetch<{redemptionVndPerPoint:number|null}>("/loyalty")
      .then((policy) => {
        if (!active) return;
        setRate(policy.redemptionVndPerPoint);
        setRateError(policy.redemptionVndPerPoint ? "" : "Cửa hàng chưa cấu hình tỷ lệ sử dụng điểm.");
      })
      .catch((caught: unknown) => {
        if (active) setRateError(caught instanceof Error ? caught.message : "Không tải được chính sách điểm");
      })
      .finally(() => { if (active) setRateLoading(false); });
    apiFetch<Cart>("/cart")
      .then((current) => {
        if (active) setCart(current);
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Không tải được giỏ hàng");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ready, session]);

  async function updateItem(item: CartItem, patch: {
    sizeOptionId?: string;
    toppingOptionIds?: string[];
    quantity?: number;
  }) {
    setBusyItem(item.id);
    setError("");
    try {
      const updated = await apiFetch<Cart>(`/cart/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setCart(updated);
      setQuote(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không cập nhật được món");
    } finally {
      setBusyItem("");
    }
  }

  async function removeItem(itemId: string) {
    setBusyItem(itemId);
    setError("");
    try {
      setCart(
        await apiFetch<Cart>(`/cart/items/${itemId}`, { method: "DELETE" }),
      );
      setQuote(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không xóa được món");
    } finally {
      setBusyItem("");
    }
  }

  const points = pointsInput === "" ? 0 : Number(pointsInput);
  const maxPoints = rate && cart ? Math.max(0, Math.min(session?.user.pointsBalance ?? 0, Math.floor(cart.total / rate))) : 0;
  const invalidPoints = !Number.isInteger(points) || points < 0 || points > maxPoints;

  async function reloadRate() {
    setRateLoading(true);
    setRateError("");
    try {
      const policy = await apiFetch<{redemptionVndPerPoint:number|null}>("/loyalty");
      setRate(policy.redemptionVndPerPoint);
      if (!policy.redemptionVndPerPoint) setRateError("Cửa hàng chưa cấu hình tỷ lệ sử dụng điểm.");
    } catch (caught) {
      setRateError(caught instanceof Error ? caught.message : "Không tải được chính sách điểm");
    } finally {
      setRateLoading(false);
    }
  }

  async function getQuote() {
    if (invalidPoints) return;
    setError("");
    try {
      const result = await apiFetch<Quote>("/orders/quote", {
        method: "POST",
        body: JSON.stringify({ pointsRedeemed: points }),
      });
      setQuote(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tính được giá đơn");
    }
  }

  async function createOrder() {
    if (invalidPoints) return;
    if (!quote) { await getQuote(); return; }
    setSubmitting(true);
    setError("");
    try {
      const order = await apiFetch<{ id: string }>("/orders", {
        method: "POST",
        body: JSON.stringify({ pointsRedeemed: points, expectedSubtotal: quote.subtotal, expectedPointsDiscount: quote.pointsDiscountAmount }),
      });
      router.push(`/orders/${order.id}`);
    } catch (caught) {
      setQuote(null);
      setError(caught instanceof Error ? caught.message : "Không tạo được đơn hàng");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) return <div className="state-box" role="status">Đang tải tài khoản…</div>;
  if (!session) {
    return (
      <section className="state-box">
        <h1>Đăng nhập để xem giỏ hàng</h1>
        <Link className="primary-link" href="/login">Đăng nhập</Link>
      </section>
    );
  }
  if (loading) return <div className="state-box" role="status">Đang tải giỏ hàng…</div>;

  return (
    <section className="customer-page">
      <span className="eyebrow">YOUR CART</span>
      <h1>Giỏ hàng</h1>
      {error && <p role="alert" className="form-error">{error}</p>}
      {!cart || cart.items.length === 0 ? (
        <div className="state-box">
          <p>Giỏ hàng đang trống.</p>
          <Link className="primary-link" href="/">Chọn món</Link>
        </div>
      ) : (
        <div className="cart-layout">
          <div className="cart-items">
            {cart.items.map((item) => (
              <article className="cart-item" key={item.id}>
                <div className="cart-item-heading">
                  <Link className="cart-product-photo" href={`/products/${item.productId}`}>
                    <Image src={productImage(item.productId)} alt={item.productName} fill sizes="(min-width: 900px) 112px, 80px" />
                  </Link>
                  <div className="cart-product-info">
                    <h2><Link href={`/products/${item.productId}`}>{item.productName}</Link></h2>
                    <p className="muted small-note">Size {item.selectedSize} · {item.quantity} ly</p>
                    {!item.productIsAvailable && (
                      <p className="form-error">Món hiện đã tạm ngừng bán.</p>
                    )}
                  </div>
                  <strong>{formatVndPrice(item.lineTotal)}</strong>
                </div>
                <div className="cart-controls">
                  <label>
                    Size
                    <select
                      value={item.sizeOptionId ?? ""}
                      disabled={busyItem === item.id || !item.productIsAvailable}
                      onChange={(event) =>
                        void updateItem(item, { sizeOptionId: event.target.value })
                      }
                    >
                      {item.availableSizes.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name} (+{formatVndPrice(option.additionalPrice)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Số lượng
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={item.quantity}
                      disabled={busyItem === item.id}
                      onChange={(event) => {
                        const quantity = Number(event.target.value);
                        if (Number.isInteger(quantity) && quantity > 0 && quantity <= 20) {
                          void updateItem(item, { quantity });
                        }
                      }}
                    />
                  </label>
                </div>
                <fieldset className="cart-toppings">
                  <legend>Topping</legend>
                  {item.availableToppings.map((option) => (
                    <label className="check-option" key={option.id}>
                      <input
                        type="checkbox"
                        checked={item.toppingOptionIds.includes(option.id)}
                        disabled={busyItem === item.id || !item.productIsAvailable}
                        onChange={() =>
                          void updateItem(item, {
                            toppingOptionIds: item.toppingOptionIds.includes(option.id)
                              ? item.toppingOptionIds.filter((id) => id !== option.id)
                              : [...item.toppingOptionIds, option.id],
                          })
                        }
                      />
                      {option.name} (+{formatVndPrice(option.additionalPrice)})
                    </label>
                  ))}
                </fieldset>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busyItem === item.id}
                  onClick={() => void removeItem(item.id)}
                >
                  Xóa món
                </button>
              </article>
            ))}
          </div>
          <aside className="order-summary">
            <h2>Tóm tắt đơn hàng</h2>
            <p>Tạm tính <strong>{formatVndPrice(cart.total)}</strong></p>
            <label htmlFor="points-redeemed">
              Điểm sử dụng (số dư: {session.user.pointsBalance})
              <input
                id="points-redeemed"
                type="number"
                inputMode="numeric"
                min={0}
                max={maxPoints}
                step={1}
                disabled={rateLoading || !rate}
                value={pointsInput}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next === "" || /^\d+$/.test(next)) setPointsInput(next);
                  setQuote(null);
                  setError("");
                }}
                onBlur={() => { if (pointsInput === "") setPointsInput("0"); }}
              />
            </label>
            {rateLoading ? <p className="muted small-note" role="status">Đang tải chính sách điểm…</p> : rate ? (
              <p className="muted small-note">1 điểm = {formatVndPrice(rate)}. Đơn này dùng tối đa <strong>{maxPoints}</strong> điểm.</p>
            ) : (
              <div className="inline-feedback" role="alert"><span>{rateError || "Chưa thể sử dụng điểm lúc này."}</span><button type="button" className="text-button" onClick={() => void reloadRate()}>Thử lại</button></div>
            )}
            {invalidPoints && <p role="alert" className="form-error">Chỉ dùng tối đa {maxPoints} điểm cho đơn này.</p>}
            <div className="summary-actions">
              <button type="button" className="secondary-button" disabled={!rate || maxPoints === 0} onClick={() => {setPointsInput(String(maxPoints));setQuote(null);setError("");}}>Dùng tối đa</button>
              <button type="button" className="secondary-button" disabled={!rate || points === 0} onClick={() => {setPointsInput("0");setQuote(null);setError("");}}>Không dùng điểm</button>
            </div>
            {quote && (
              <div className="quote-details" aria-live="polite">
                <p>Giảm bằng điểm <strong>{formatVndPrice(quote.pointsDiscountAmount)}</strong></p>
                <p>{quote.vnpayPayableAmount === 0 ? "Thanh toán hoàn toàn bằng điểm" : "Thanh toán VNPay"} <strong>{formatVndPrice(quote.vnpayPayableAmount)}</strong></p>
              </div>
            )}
            <button type="button" className="secondary-button" disabled={invalidPoints || rateLoading} onClick={() => void getQuote()}>
              {quote ? "Tính lại tổng tiền" : "Xem giá chính thức"}
            </button>
            <button
              type="button"
              disabled={invalidPoints || submitting || cart.items.some((item) => !item.productIsAvailable)}
              onClick={() => void createOrder()}
            >
              {submitting ? "Đang tạo đơn…" : quote ? "Xác nhận và tạo đơn" : "Xem giá trước khi đặt"}
            </button>
            <p className="muted small-note">
              Đơn chờ thanh toán tối đa 15 phút. Kho chưa bị trừ khi tạo đơn.
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}
