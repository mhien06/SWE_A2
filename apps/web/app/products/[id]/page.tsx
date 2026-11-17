import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  availabilityLabel,
  formatVndPrice,
  productImage,
  type ProductDetail,
} from "../../catalog";
import ProductOptionsForm from "../../components/product-options-form";
import CustomerMenuGuard from "../../components/customer-menu-guard";

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!uuidV4.test(id)) notFound();

  const apiUrl =
    process.env.API_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3001";
  const response = await fetch(`${apiUrl}/products/${id}`, { cache: "no-store" });

  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("Không tải được món");

  const product = (await response.json()) as ProductDetail;
  return (
    <CustomerMenuGuard>
      <Link className="back-link" href="/">← Menu</Link>

      <article className="detail-card">
        <div className="detail-image-wrap">
          <Image
            className="detail-image"
            src={productImage(product.id)}
            alt={product.name}
            fill
            sizes="(max-width: 760px) 100vw, 50vw"
          />
        </div>

        <div className="detail-content">
          <span className="eyebrow">BREWLITE COFFEE</span>
          <h1>{product.name}</h1>
          <p className="detail-description">{product.description}</p>
          <p className="detail-price">{formatVndPrice(product.basePrice)}</p>

          <ProductOptionsForm product={product} />

          <div className="availability">
            <span>Trạng thái</span>
            <strong>{availabilityLabel(product.isAvailable)}</strong>
          </div>
        </div>
      </article>
    </CustomerMenuGuard>
  );
}
