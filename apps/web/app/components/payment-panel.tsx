"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatVndPrice } from "../catalog";
import {
  clearStoredIdempotencyKey,
  paymentApiRequest,
  startVnpayPayment,
  type OrderPaymentStatusDto,
  type OrderStatus,
  type PaymentStatus,
} from "../lib/payment-client";

const paymentStatusLabels: Record<PaymentStatus, string> = {
  PENDING: "Đang chờ thanh toán",
  UNKNOWN: "Đang đối soát giao dịch",
  SUCCEEDED: "Thanh toán VNPay đã xác nhận",
  FAILED: "Thanh toán không thành công",
  EXPIRED: "Lượt thanh toán đã hết hạn",
};

const orderStatusLabels: Record<OrderStatus, string> = {
  PENDING: "Chờ thanh toán",
  PAYMENT_FAILED: "Thanh toán thất bại (có thể thử lại)",
  PAYMENT_EXCEPTION: "Ngoại lệ thanh toán (thiếu nguyên liệu)",
  PAID: "Đã thanh toán",
  PREPARING: "Đang pha chế",
  READY_FOR_PICKUP: "Sẵn sàng nhận món",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};

export interface PaymentPanelProps {
  orderId: string;
  token?: string | null;
  returnedFromGateway?: boolean;
  onSettled?: (snapshot: OrderPaymentStatusDto) => void;
  onNavigateToGateway?: (url: string) => void;
}

export default function PaymentPanel({
  orderId,
  token,
  returnedFromGateway = false,
  onSettled,
  onNavigateToGateway,
}: PaymentPanelProps) {
  const [fallbackToken, setFallbackToken] = useState<string | null>(() =>
    orderId === "demo-order-01" ? "demo-user-01" : null,
  );
  const effectiveToken = token ?? fallbackToken;
  const [snapshot, setSnapshot] = useState<OrderPaymentStatusDto | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!effectiveToken) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function loadStatus() {
      try {
        const data = await paymentApiRequest<OrderPaymentStatusDto>(
          `/orders/${encodeURIComponent(orderId)}/payment-status`,
          { token: effectiveToken ?? undefined, cache: "no-store" },
        );
        if (cancelled) return;
        setSnapshot(data);
        setError("");
        setNow(Date.now());

        if (data.canRetry) {
          clearStoredIdempotencyKey(orderId);
        }
        if (
          data.payment?.status === "SUCCEEDED" &&
          (data.orderStatus === "PAID" ||
            data.orderStatus === "PAYMENT_EXCEPTION" ||
            data.orderStatus === "CANCELLED") &&
          onSettled
        ) {
          onSettled(data);
        }
        if (
          data.payment &&
          (data.payment.status === "PENDING" ||
            data.payment.status === "UNKNOWN")
        ) {
          timer = setTimeout(() => {
            void loadStatus();
          }, 5000);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Không tải được trạng thái thanh toán.",
          );
        }
      }
    }

    void loadStatus();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, effectiveToken, refreshCount, onSettled]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function handlePayClick() {
    if (busy || !effectiveToken) return;
    setBusy(true);
    setError("");
    try {
      await startVnpayPayment(orderId, effectiveToken, onNavigateToGateway);
      setRefreshCount((v) => v + 1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể khởi tạo thanh toán VNPay.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!effectiveToken) {
    return (
      <div className="state-box" role="status">
        <p>Vui lòng đăng nhập để xem trạng thái thanh toán đã xác minh.</p>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap", marginTop: ".75rem" }}>
          <Link
            className="back-link"
            href={`/login?next=${encodeURIComponent(`/payment/return?orderId=${orderId}`)}`}
          >
            Đăng nhập
          </Link>
          <button
            type="button"
            onClick={() => setFallbackToken("demo-user-01")}
          >
            Dùng phiên kiểm thử (demo-user-01)
          </button>
        </div>
      </div>
    );
  }

  const payment = snapshot?.payment ?? null;
  const attemptRemainingSec = payment
    ? Math.max(
        0,
        Math.ceil((new Date(payment.expiresAt).getTime() - now) / 1000),
      )
    : 0;
  const orderRemainingSec = snapshot?.orderExpiresAt
    ? Math.max(
        0,
        Math.ceil((new Date(snapshot.orderExpiresAt).getTime() - now) / 1000),
      )
    : 0;

  const isWaitingVerification =
    Boolean(payment) &&
    (payment?.status === "PENDING" || payment?.status === "UNKNOWN") &&
    (returnedFromGateway ||
      attemptRemainingSec === 0 ||
      Boolean(payment?.awaitingVerification));

  const canContinueExistingAttempt =
    Boolean(payment?.paymentUrl) &&
    attemptRemainingSec > 0 &&
    !snapshot?.needsReview &&
    !returnedFromGateway;

  let headline = "Đang tải trạng thái…";
  if (snapshot) {
    if (snapshot.orderStatus === "PAYMENT_EXCEPTION") {
      headline = "Giao dịch phát sinh ngoại lệ (thiếu nguyên liệu)";
    } else if (
      snapshot.orderStatus === "CANCELLED" &&
      payment?.status === "SUCCEEDED"
    ) {
      headline = "Thanh toán đến muộn sau khi đơn đã hủy";
    } else if (snapshot.needsReview) {
      headline = "Giao dịch cần kiểm tra / đối soát";
    } else if (isWaitingVerification) {
      headline = "Đang xác minh kết quả thanh toán";
    } else if (payment) {
      headline = paymentStatusLabels[payment.status];
    } else {
      headline = "Đơn chưa khởi tạo lượt thanh toán";
    }
  }

  return (
    <section
      className="payment-panel"
      aria-label={`Thanh toán đơn ${orderId}`}
      style={{
        marginTop: "1.25rem",
        padding: "1.25rem",
        background: "#fffaf4",
        border: "1px solid var(--line)",
        borderRadius: "1rem",
      }}
    >
      <p role="status" aria-live="polite" style={{ fontSize: "1.05rem" }}>
        <strong>{headline}</strong>
      </p>

      {snapshot && (
        <div
          style={{
            marginTop: ".75rem",
            display: "grid",
            gap: ".35rem",
            fontSize: ".9rem",
          }}
        >
          <div>
            <span>Trạng thái đơn hàng: </span>
            <strong>{orderStatusLabels[snapshot.orderStatus]}</strong>
          </div>
          <div>
            <span>Tổng tiền đơn hàng: </span>
            <strong>{formatVndPrice(snapshot.totalAmount)}</strong>
          </div>
          {snapshot.pointsRedeemed > 0 && (
            <div>
              <span>Điểm BrewLite đã dùng ({snapshot.pointsRedeemed} điểm): </span>
              <strong>-{formatVndPrice(snapshot.pointsDiscountAmount)}</strong>
            </div>
          )}
          <div>
            <span>Số tiền VNPay thực trả: </span>
            <strong data-testid="vnpay-payable-amount">
              {formatVndPrice(snapshot.vnpayPayableAmount)}
            </strong>
          </div>
          {orderRemainingSec > 0 &&
            (snapshot.orderStatus === "PENDING" ||
              snapshot.orderStatus === "PAYMENT_FAILED") && (
              <div>
                <span>Thời hạn thanh toán đơn: </span>
                <strong>
                  {Math.floor(orderRemainingSec / 60)}:
                  {String(orderRemainingSec % 60).padStart(2, "0")}
                </strong>
              </div>
            )}
        </div>
      )}

      {snapshot?.orderStatus === "PAYMENT_EXCEPTION" && (
        <p style={{ marginTop: ".75rem", color: "#8a2d1b" }}>
          VNPay đã xác nhận thu tiền nhưng nguyên liệu tại quầy không còn đủ để
          pha chế. Đơn không chuyển sang pha chế và hệ thống bù điểm BrewLite
          theo chính sách (1 điểm / 100đ, làm tròn lên).
        </p>
      )}

      {snapshot?.orderStatus === "CANCELLED" &&
        payment?.status === "SUCCEEDED" && (
          <p style={{ marginTop: ".75rem", color: "#8a2d1b" }}>
            Kết quả thanh toán đến sau khi đơn đã hủy. Đơn không được mở lại và
            giá trị thanh toán được đối soát bù bằng điểm BrewLite.
          </p>
        )}

      {snapshot?.needsReview &&
        snapshot.orderStatus !== "PAYMENT_EXCEPTION" && (
          <p style={{ marginTop: ".75rem" }}>
            Hệ thống đã ghi nhận giao dịch cần đối soát. Vui lòng kiểm tra chi
            tiết đơn hàng hoặc liên hệ cửa hàng.
          </p>
        )}

      {isWaitingVerification && (
        <p style={{ marginTop: ".75rem" }}>
          BrewLite đang xác minh kết quả từ VNPay Sandbox (IPN/QueryDR). Vui
          lòng chờ xác minh và không tạo giao dịch mới để tránh thanh toán trùng.
        </p>
      )}

      {canContinueExistingAttempt && (
        <p style={{ marginTop: ".75rem" }}>
          Thời gian còn lại của lượt thanh toán:{" "}
          <strong>
            {Math.floor(attemptRemainingSec / 60)}:
            {String(attemptRemainingSec % 60).padStart(2, "0")}
          </strong>
        </p>
      )}

      {error && (
        <p
          role="alert"
          style={{ marginTop: ".75rem", color: "#b42318", fontWeight: 600 }}
        >
          {error}
        </p>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: ".65rem",
          marginTop: "1rem",
        }}
      >
        {(snapshot?.canPay || snapshot?.canRetry) && (
          <button type="button" disabled={busy} onClick={handlePayClick}>
            {busy
              ? "Đang mở VNPay…"
              : snapshot.canRetry
                ? "Thanh toán lại"
                : "Thanh toán VNPay"}
          </button>
        )}

        {canContinueExistingAttempt && payment?.paymentUrl && (
          <a
            className="back-link"
            href={payment.paymentUrl}
            style={{ marginBottom: 0, background: "var(--brown)", color: "#fff" }}
          >
            Tiếp tục thanh toán
          </a>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => setRefreshCount((v) => v + 1)}
          style={{
            background: "white",
            color: "var(--brown-dark)",
            border: "1px solid var(--line)",
          }}
        >
          Kiểm tra trạng thái
        </button>

        <Link
          className="back-link"
          href={`/orders/${orderId}`}
          style={{ marginBottom: 0 }}
        >
          Xem chi tiết đơn
        </Link>
      </div>
    </section>
  );
}
