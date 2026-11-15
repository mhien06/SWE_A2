"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatVndPrice, splitOptions, type ProductDetail } from "../catalog";
import { apiFetch } from "../lib/api";
import { useAuthSession } from "./auth-session";

export default function ProductOptionsForm({
  product,
}: {
  product: ProductDetail;
}) {
  const router = useRouter();
  const { session, ready } = useAuthSession();
  const { sizes, toppings } = splitOptions(product.options);
  const [sizeId, setSizeId] = useState(sizes[0]?.id ?? "");
  const [toppingIds, setToppingIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const size = sizes.find((option) => option.id === sizeId);
  const toppingTotal = toppings
    .filter((option) => toppingIds.includes(option.id))
    .reduce((sum, option) => sum + option.additionalPrice, 0);
  const total =
    (product.basePrice + (size?.additionalPrice ?? 0) + toppingTotal) * quantity;

  function toggleTopping(id: string) {
    setToppingIds((selected) =>
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
    );
  }

  async function addToCart() {
    setError("");
    setBusy(true);
    try {
      await apiFetch("/cart/items", {
        method: "POST",
        body: JSON.stringify({
          productId: product.id,
          sizeOptionId: sizeId,
          toppingOptionIds: toppingIds,
          quantity,
        }),
      });
      router.push("/cart");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể thêm món");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="order-options" aria-label="Tùy chọn món">
      <label>
        Kích thước
        <select value={sizeId} onChange={(event) => setSizeId(event.target.value)}>
          {sizes.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} (+{formatVndPrice(option.additionalPrice)})
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend>Topping</legend>
        {toppings.map((option) => (
          <label className="check-option" key={option.id}>
            <input
              type="checkbox"
              checked={toppingIds.includes(option.id)}
              onChange={() => toggleTopping(option.id)}
            />
            {option.name} (+{formatVndPrice(option.additionalPrice)})
          </label>
        ))}
      </fieldset>

      <label>
        Số lượng
        <input
          type="number"
          min={1}
          max={20}
          value={quantity}
          onChange={(event) =>
            setQuantity(Math.max(1, Math.min(20, Number(event.target.value) || 1)))
          }
        />
      </label>
      <p className="detail-price">Tạm tính: {formatVndPrice(total)}</p>
      {!ready ? (
        <p role="status">Đang kiểm tra đăng nhập…</p>
      ) : !session ? (
        <Link className="primary-link" href="/login">Đăng nhập để thêm vào giỏ</Link>
      ) : (
        <button type="button" disabled={busy || !sizeId} onClick={addToCart}>
          {busy ? "Đang thêm…" : "Thêm vào giỏ"}
        </button>
      )}
      {error && <p role="alert" className="form-error">{error}</p>}
    </section>
  );
}
