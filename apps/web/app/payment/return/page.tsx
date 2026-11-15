import type { Metadata } from "next";
import Link from "next/link";
import PaymentPanel from "../../components/payment-panel";

export const metadata: Metadata = {
  title: "Kết quả thanh toán – BrewLite",
};

function isValidOrderIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]{1,64}$/.test(value.trim())
  );
}

export default async function PaymentReturnPage({
  searchParams,
  token,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  token?: string | null;
}) {
  const params = await searchParams;
  const rawOrderId = params?.orderId;
  const validOrderId = isValidOrderIdentifier(rawOrderId)
    ? rawOrderId.trim()
    : null;

  // ADR-004 & SRS FR-09: Bỏ qua hoàn toàn vnp_ResponseCode / vnp_TransactionStatus trên Return URL.
  // Chỉ dùng orderId để truy vấn trạng thái đã được backend xác minh từ cơ sở dữ liệu.
  return (
    <div className="payment-return-page">
      <span className="eyebrow">BREWLITE PAYMENT</span>
      <h1>Kết quả thanh toán</h1>
      {validOrderId ? (
        <>
          <p>Mã đơn hàng: #{validOrderId}</p>
          <PaymentPanel
            orderId={validOrderId}
            token={token}
            returnedFromGateway
          />
        </>
      ) : (
        <div className="state-box" role="alert">
          <p>
            Không tìm thấy mã đơn hàng hợp lệ. Vui lòng kiểm tra trong lịch sử
            đơn hàng.
          </p>
        </div>
      )}
      <div style={{ marginTop: "1.25rem" }}>
        <Link className="back-link" href="/orders">
          Lịch sử đơn hàng
        </Link>
      </div>
    </div>
  );
}
