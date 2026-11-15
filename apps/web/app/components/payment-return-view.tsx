import Link from "next/link";
import "../payment/payment-theme.css";
import PaymentPanel from "./payment-panel";

export function isValidOrderIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]{1,64}$/.test(value.trim())
  );
}

export async function renderPaymentReturnPage({
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
    <main className="brewlite-payment-scope">
      <div className="inner-page">
        <div className="checkout-success">
          <div className="success-icon" aria-hidden="true">
            ✓
          </div>
          <span className="section-kicker">BREWLITE PAYMENT · VNPAY SANDBOX</span>
          <h1 className="page-title">Kết quả thanh toán</h1>
          {validOrderId ? (
            <>
              <p className="page-lead">
                Mã đơn hàng: <strong>#{validOrderId}</strong>. Trạng thái được tải
                trực tiếp từ máy chủ BrewLite sau khi đối chiếu IPN hoặc QueryDR.
              </p>
              <PaymentPanel
                orderId={validOrderId}
                token={token}
                returnedFromGateway
              />
            </>
          ) : (
            <div className="error-card" role="alert">
              Không tìm thấy mã đơn hàng hợp lệ. Vui lòng kiểm tra trong lịch sử
              đơn hàng.
            </div>
          )}
          <div className="actions-row">
            <Link className="button button-outline" href="/orders">
              Lịch sử đơn hàng
            </Link>
            <Link className="button button-outline" href="/">
              Quay lại thực đơn
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
