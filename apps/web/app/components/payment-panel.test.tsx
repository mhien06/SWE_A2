import type React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CheckoutReturnPage from "../checkout/return/page";
import { saveSession } from "../lib/api";
import PaymentReturnPage from "../payment/return/page";
import { AuthSessionProvider } from "./auth-session";
import PaymentPanel from "./payment-panel";
import type { OrderPaymentStatusDto } from "../lib/payment-client";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const baseStatus: OrderPaymentStatusDto = {
  orderId: "order-uuid-12",
  orderCode: "BL-0012",
  orderStatus: "PENDING",
  subtotal: 35050,
  discountAmount: 0,
  totalAmount: 35050,
  pointsRedeemed: 60,
  pointsDiscountAmount: 6000,
  vnpayPayableAmount: 29050,
  orderExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  canPay: false,
  canRetry: false,
  needsReview: false,
  payment: {
    paymentId: "pay-uuid-1",
    orderId: "order-uuid-12",
    orderStatus: "PENDING",
    provider: "VNPAY_SANDBOX",
    transactionRef: "TXN0012",
    idempotencyKey: "idem-0012",
    amount: 29050,
    status: "PENDING",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    orderExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    verifiedAt: null,
    awaitingVerification: false,
    paymentUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?test=1",
    needsReview: false,
  },
};

describe("PaymentPanel & PaymentReturnPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("displays official backend total, points redeemed, VNPay payable amount and continues a live attempt without offering retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => baseStatus,
      }),
    );

    render(
      <AuthSessionProvider>
        <PaymentPanel orderId="order-uuid-12" token="jwt-token" />
      </AuthSessionProvider>,
    );

    expect(
      await screen.findByRole("link", { name: "Tiếp tục thanh toán" }),
    ).toHaveAttribute("href", baseStatus.payment!.paymentUrl!);
    expect(screen.getByTestId("vnpay-payable-amount")).toHaveTextContent(
      "29.050đ",
    );
    expect(
      screen.queryByRole("button", { name: "Thanh toán lại" }),
    ).not.toBeInTheDocument();
  });

  it("never marks order PAID from forged Return URL vnp_ResponseCode=00 when backend is still PENDING/UNKNOWN", async () => {
    saveSession({
      accessToken: "jwt-token",
      user: {
        id: "user-1",
        name: "Nguyễn Minh Hiển",
        email: "hien@example.com",
        role: "CUSTOMER",
        pointsBalance: 0,
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...baseStatus,
          payment: {
            ...baseStatus.payment!,
            status: "UNKNOWN",
            awaitingVerification: true,
            paymentUrl: null,
          },
        }),
      }),
    );

    const view = await PaymentReturnPage({
      searchParams: Promise.resolve({
        orderId: "order-uuid-12",
        vnp_ResponseCode: "00",
        vnp_TransactionStatus: "00",
      }),
    });

    render(<AuthSessionProvider>{view}</AuthSessionProvider>);

    expect(
      await screen.findByText("Đang xác minh kết quả thanh toán"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Thanh toán VNPay đã xác nhận"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Thanh toán lại" }),
    ).not.toBeInTheDocument();
  });

  it("also renders checkout/return safely with AuthSessionProvider", async () => {
    saveSession({
      accessToken: "jwt-token",
      user: {
        id: "user-1",
        name: "Nguyễn Minh Hiển",
        email: "hien@example.com",
        role: "CUSTOMER",
        pointsBalance: 0,
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...baseStatus,
          payment: {
            ...baseStatus.payment!,
            status: "UNKNOWN",
            awaitingVerification: true,
            paymentUrl: null,
          },
        }),
      }),
    );

    const view = await CheckoutReturnPage({
      searchParams: Promise.resolve({
        orderId: "order-uuid-12",
        vnp_ResponseCode: "00",
      }),
    });

    render(<AuthSessionProvider>{view}</AuthSessionProvider>);

    expect(
      await screen.findByText("Đang xác minh kết quả thanh toán"),
    ).toBeInTheDocument();
  });

  it("shows retry button only when backend allows canRetry and clears old Idempotency-Key", async () => {
    window.sessionStorage.setItem(
      "brewlite_swe_a2_payment_order-uuid-12",
      "old-key",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...baseStatus,
          orderStatus: "PAYMENT_FAILED",
          canRetry: true,
          payment: {
            ...baseStatus.payment!,
            status: "FAILED",
            paymentUrl: null,
          },
        }),
      }),
    );

    render(
      <AuthSessionProvider>
        <PaymentPanel orderId="order-uuid-12" token="jwt-token" />
      </AuthSessionProvider>,
    );

    expect(
      await screen.findByRole("button", { name: "Thanh toán lại" }),
    ).toBeInTheDocument();
    expect(
      window.sessionStorage.getItem("brewlite_swe_a2_payment_order-uuid-12"),
    ).toBeNull();
  });

  it("renders PAYMENT_EXCEPTION state clearly when ingredients are insufficient after VNPay payment", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...baseStatus,
          orderStatus: "PAYMENT_EXCEPTION",
          needsReview: true,
          payment: {
            ...baseStatus.payment!,
            status: "SUCCEEDED",
            paymentUrl: null,
          },
        }),
      }),
    );

    render(
      <AuthSessionProvider>
        <PaymentPanel orderId="order-uuid-12" token="jwt-token" />
      </AuthSessionProvider>,
    );

    expect(
      await screen.findByText(
        "Giao dịch phát sinh ngoại lệ (thiếu nguyên liệu)",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/bù điểm BrewLite theo chính sách/i),
    ).toBeInTheDocument();
  });
});
