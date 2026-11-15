"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatVndPrice } from "../catalog";
import "../payment/payment-theme.css";
import { useAuthSession } from "./auth-session";
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
  onSnapshot?: (snapshot: OrderPaymentStatusDto) => void;
  onNavigateToGateway?: (url: string) => void;
}

export default function PaymentPanel({
  orderId,
  token,
  returnedFromGateway = false,
  onSettled,
  onSnapshot,
  onNavigateToGateway,
}: PaymentPanelProps) {
  const { session, ready } = useAuthSession();
  const effectiveToken = token ?? session?.accessToken ?? null;
  const authIsReady = Boolean(token) || ready;

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
        onSnapshot?.(data);
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
  }, [orderId, effectiveToken, refreshCount, onSettled, onSnapshot]);

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
    if (!authIsReady) {
      return (
        <div className="brewlite-payment-scope">
          <section className="payment-panel" role="status">
            <p>Đang kiểm tra phiên đăng nhập…</p>
          </section>
        </div>
      );
    }
    return (
      <div className="brewlite-payment-scope">
        <div className="payment-panel" role="status">
          <p>Vui lòng đăng nhập để xem trạng thái thanh toán đã xác minh.</p>
          <div className="actions-row">
            <Link
              className="button button-primary"
              href={`/login?next=${encodeURIComponent(`/payment/return?orderId=${orderId}`)}`}
            >
              Đăng nhập
            </Link>
            <Link className="button button-outline" href="/orders">
              Lịch sử đơn hàng
            </Link>
          </div>
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
  let statusBadgeClass = "order-status";

  if (snapshot) {
    if (snapshot.orderStatus === "PAYMENT_EXCEPTION") {
      headline = "Giao dịch phát sinh ngoại lệ (thiếu nguyên liệu)";
      statusBadgeClass = "order-status order-status--danger";
    } else if (
      snapshot.orderStatus === "CANCELLED" &&
      payment?.status === "SUCCEEDED"
    ) {
      headline = "Thanh toán đến muộn sau khi đơn đã hủy";
      statusBadgeClass = "order-status order-status--warn";
    } else if (snapshot.needsReview) {
      headline = "Giao dịch cần kiểm tra / đối soát";
      statusBadgeClass = "order-status order-status--warn";
    } else if (isWaitingVerification) {
      headline = "Đang xác minh kết quả thanh toán";
      statusBadgeClass = "order-status order-status--warn";
    } else if (payment) {
      headline = paymentStatusLabels[payment.status];
      if (payment.status === "FAILED" || payment.status === "EXPIRED") {
        statusBadgeClass = "order-status order-status--danger";
      }
    } else {
      headline = "Đơn chưa khởi tạo lượt thanh toán";
    }
  }

  return (
    <div className="brewlite-payment-scope">
      <section
        className="payment-panel"
        aria-label={`Thanh toán đơn ${orderId}`}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <p role="status" aria-live="polite" style={{ fontSize: "1.05rem", margin: 0 }}>
            <strong>{headline}</strong>
          </p>
          {snapshot && (
            <span className={statusBadgeClass}>
              {orderStatusLabels[snapshot.orderStatus]}
            </span>
          )}
        </div>

        {snapshot && (
          <div className="summary-rows">
            <div className="summary-row">
              <span>Tổng tiền đơn hàng</span>
              <strong>{formatVndPrice(snapshot.totalAmount)}</strong>
            </div>
            {snapshot.pointsRedeemed > 0 && (
              <div className="summary-row">
                <span>Điểm BrewLite đã dùng ({snapshot.pointsRedeemed} điểm)</span>
                <strong>-{formatVndPrice(snapshot.pointsDiscountAmount)}</strong>
              </div>
            )}
            <div className="summary-row summary-total">
              <span>Số tiền VNPay thực trả</span>
              <strong data-testid="vnpay-payable-amount">
                {formatVndPrice(snapshot.vnpayPayableAmount)}
              </strong>
            </div>
            {orderRemainingSec > 0 &&
              (snapshot.orderStatus === "PENDING" ||
                snapshot.orderStatus === "PAYMENT_FAILED") && (
                <div className="summary-row">
                  <span>Thời hạn thanh toán đơn</span>
                  <strong>
                    {Math.floor(orderRemainingSec / 60)}:
                    {String(orderRemainingSec % 60).padStart(2, "0")}
                  </strong>
                </div>
              )}
          </div>
        )}

        {snapshot?.orderStatus === "PAYMENT_EXCEPTION" && (
          <div className="notice-card">
            VNPay đã xác nhận thu tiền nhưng nguyên liệu tại quầy không còn đủ
            để pha chế. Đơn không chuyển sang pha chế và hệ thống bù điểm
            BrewLite theo chính sách (1 điểm / 100đ, làm tròn lên).
          </div>
        )}

        {snapshot?.orderStatus === "CANCELLED" &&
          payment?.status === "SUCCEEDED" && (
            <div className="notice-card">
              Kết quả thanh toán đến sau khi đơn đã hủy. Đơn không được mở lại
              và giá trị thanh toán được đối soát bù bằng điểm BrewLite.
            </div>
          )}

        {snapshot?.needsReview &&
          snapshot.orderStatus !== "PAYMENT_EXCEPTION" && (
            <div className="notice-card">
              Hệ thống đã ghi nhận giao dịch cần đối soát. Vui lòng kiểm tra
              chi tiết đơn hàng hoặc liên hệ cửa hàng.
            </div>
          )}

        {isWaitingVerification && (
          <div className="notice-card">
            BrewLite đang xác minh kết quả từ VNPay Sandbox (IPN/QueryDR). Vui
            lòng chờ xác minh và không tạo giao dịch mới để tránh thanh toán
            trùng.
          </div>
        )}

        {canContinueExistingAttempt && (
          <p className="item-meta" style={{ marginTop: "12px" }}>
            Thời gian còn lại của lượt thanh toán:{" "}
            <strong>
              {Math.floor(attemptRemainingSec / 60)}:
              {String(attemptRemainingSec % 60).padStart(2, "0")}
            </strong>
          </p>
        )}

        {error && (
          <p className="error-card" role="alert">
            {error}
          </p>
        )}

        <div className="actions-row">
          {(snapshot?.canPay || snapshot?.canRetry) && (
            <button
              type="button"
              className="button button-primary"
              disabled={busy}
              onClick={handlePayClick}
            >
              {busy
                ? "Đang mở VNPay…"
                : snapshot.canRetry
                  ? "Thanh toán lại"
                  : "Thanh toán VNPay"}
            </button>
          )}

          {canContinueExistingAttempt && payment?.paymentUrl && (
            <a className="button button-primary" href={payment.paymentUrl}>
              Tiếp tục thanh toán
            </a>
          )}

          <button
            type="button"
            className="button button-outline"
            disabled={busy}
            onClick={() => setRefreshCount((v) => v + 1)}
          >
            Kiểm tra trạng thái
          </button>

          <Link className="button button-outline" href={`/orders/${orderId}`}>
            Xem chi tiết đơn
          </Link>
        </div>
      </section>
    </div>
  );
}
