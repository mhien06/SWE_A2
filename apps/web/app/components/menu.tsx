"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  availabilityLabel,
  formatVndPrice,
  productImage,
  type ProductSummary,
} from "../catalog";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function Menu() {
  const [products, setProducts] = useState<ProductSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const request = new AbortController();

    fetch(`${apiUrl}/products`, { signal: request.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Không tải được menu");
        return response.json() as Promise<ProductSummary[]>;
      })
      .then(setProducts)
      .catch(() => {
        if (!request.signal.aborted) setFailed(true);
      });

    return () => request.abort();
  }, [attempt]);

  function retry() {
    setFailed(false);
    setProducts(null);
    setAttempt((value) => value + 1);
  }

  return (
    <>
      <section className="menu-hero">
        <div className="hero-copy">
        <span className="eyebrow">BREWLITE MENU</span>
        <h1>Gu của bạn.<br /><em>Ngày của bạn.</em></h1>
        <p>Chọn món yêu thích và để BrewLite chuẩn bị một trải nghiệm trọn vị.</p>
        <a className="hero-cta" href="#menu">Khám phá thực đơn <span aria-hidden="true">↗</span></a>
        <div className="hero-note">✳ Pha theo gu · Nhận tại quầy</div>
        </div>
      </section>

      <div className="category-row" aria-label="Danh mục">
        <span className="active">Tất cả</span>
        <span>Cà phê</span>
        <span>Trà</span>
        <span>Sữa</span>
      </div>

      <section className="menu-section" id="menu">
        <span className="eyebrow">OUR SELECTION</span>
        <h2>Menu của BrewLite</h2>

        {failed ? (
          <div className="state-box" role="alert">
            <p>Không tải được menu.</p>
            <button type="button" onClick={retry}>Thử lại</button>
          </div>
        ) : products === null ? (
          <div className="state-box" role="status">Đang tải thực đơn…</div>
        ) : products.length === 0 ? (
          <div className="state-box">Thực đơn chưa có món.</div>
        ) : (
          <div className="product-grid">
            {products.map((product) => (
              <article className="product-card" key={product.id}>
                <Link className="image-link" href={`/products/${product.id}`}>
                  <Image
                    className="product-image"
                    src={productImage(product.id)}
                    alt={product.name}
                    fill
                    sizes="(max-width: 680px) 100vw, (max-width: 1000px) 50vw, 25vw"
                  />
                  <span className="card-badge">
                    {availabilityLabel(product.isAvailable)}
                  </span>
                </Link>

                <div className="card-content">
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <div className="card-bottom">
                    <strong>{formatVndPrice(product.basePrice)}</strong>
                    <Link href={`/products/${product.id}`}>Xem chi tiết</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
