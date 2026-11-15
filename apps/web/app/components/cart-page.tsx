"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatVndPrice } from "../catalog";
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
  const [points, setPoints] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ready || !session) return;
    let active = true;
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

  async function getQuote() {
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
    setSubmitting(true);
    setError("");
    try {
      const order = await apiFetch<{ id: string }>("/orders", {
        method: "POST",
        body: JSON.stringify({ pointsRedeemed: points }),
      });
      router.push(`/orders/${order.id}`);
    } catch (caught) {
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
                  <div>
                    <h2>{item.productName}</h2>
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
            <label>
              Điểm sử dụng (số dư: {session.user.pointsBalance})
              <input
                type="number"
                min={0}
                max={session.user.pointsBalance}
                value={points}
                onChange={(event) => {
                  setPoints(Math.max(0, Number(event.target.value) || 0));
                  setQuote(null);
                }}
              />
            </label>
            {quote && (
              <div className="quote-details" aria-live="polite">
                <p>Giảm bằng điểm <strong>{formatVndPrice(quote.pointsDiscountAmount)}</strong></p>
                <p>Thanh toán VNPay <strong>{formatVndPrice(quote.vnpayPayableAmount)}</strong></p>
              </div>
            )}
            <button type="button" className="secondary-button" onClick={() => void getQuote()}>
              Xem giá chính thức
            </button>
            <button
              type="button"
              disabled={submitting || cart.items.some((item) => !item.productIsAvailable)}
              onClick={() => void createOrder()}
            >
              {submitting ? "Đang tạo đơn…" : "Tạo đơn hàng"}
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
