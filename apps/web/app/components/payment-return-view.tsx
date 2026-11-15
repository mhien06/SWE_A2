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
    <div className="brewlite-payment-scope">
      <div className="inner-page">
        <div className="checkout-success payment-result">
          <div className="payment-result-heading">
            <div className="payment-result-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.7" /><path d="M3 10h18M7 15h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
            </div>
            <div>
              <span className="section-kicker">BREWLITE · VNPAY SANDBOX</span>
              <h1 className="page-title">Kết quả thanh toán</h1>
            </div>
          </div>
          {validOrderId ? (
            <>
              <p className="payment-result-reference"><span>Mã đơn hàng</span><strong>#{validOrderId}</strong></p>
              <p className="page-lead">Theo dõi kết quả thanh toán và thông tin đơn hàng của bạn.</p>
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
          <div className="actions-row payment-result-navigation">
            <Link className="button button-outline" href="/orders">
              Lịch sử đơn hàng
            </Link>
            <Link className="button button-outline" href="/">
              Quay lại thực đơn
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
