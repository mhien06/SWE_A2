import type React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutView } from "./page";

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

const customerSession = {
  accessToken: "jwt-customer-token",
  account: {
    id: "user-1",
    fullName: "Nguyễn Minh Hiển",
    email: "hien@example.com",
    role: "CUSTOMER" as const,
  },
};

const sampleCart = [
  {
    key: "p1-s1",
    productId: "11111111-1111-4111-8111-111111111111",
    name: "Cà phê sữa đá",
    sizeOptionId: "size-m",
    sizeName: "M",
    toppingOptionIds: ["top-1"],
    toppings: [{ id: "top-1", name: "Kem phô mai" }],
    unitPrice: 39000,
    quantity: 1,
  },
];

describe("CheckoutView", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("prevents duplicate submission on double-click, creates order and initiates VNPay payment with Idempotency-Key", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/orders")) {
        return {
          ok: true,
          json: async () => ({
            orderId: "order-uuid-99",
            orderCode: "BL-0099",
            orderStatus: "PENDING",
            subtotal: 39000,
            discountAmount: 0,
            totalAmount: 39000,
            pointsRedeemed: 0,
            pointsDiscountAmount: 0,
            vnpayPayableAmount: 39000,
            orderExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
            payment: null,
            canPay: true,
            canRetry: false,
            needsReview: false,
          }),
        };
      }
      if (url.endsWith("/payments")) {
        return {
          ok: true,
          json: async () => ({
            paymentId: "pay-uuid-99",
            orderId: "order-uuid-99",
            orderStatus: "PENDING",
            provider: "VNPAY_SANDBOX",
            transactionRef: "TXN0099",
            idempotencyKey: "key-99",
            amount: 39000,
            status: "PENDING",
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            orderExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
            verifiedAt: null,
            awaitingVerification: false,
            paymentUrl:
              "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=TXN0099",
            needsReview: false,
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          orderId: "order-uuid-99",
          orderCode: "BL-0099",
          orderStatus: "PENDING",
          subtotal: 39000,
          discountAmount: 0,
          totalAmount: 39000,
          pointsRedeemed: 0,
          pointsDiscountAmount: 0,
          vnpayPayableAmount: 39000,
          orderExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
          payment: null,
          canPay: true,
          canRetry: false,
          needsReview: false,
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const onClearCart = vi.fn();
    const onNavigate = vi.fn();

    render(
      <CheckoutView
        initialSession={customerSession}
        initialCart={sampleCart}
        onClearCart={onClearCart}
        onNavigateToGateway={onNavigate}
      />,
    );

    const button = screen.getByRole("button", {
      name: "Đặt hàng và thanh toán VNPay",
    });
    // Double-click liên tiếp
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(onNavigate).toHaveBeenCalledOnce());
    expect(onClearCart).toHaveBeenCalledOnce();

    const orderCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).endsWith("/orders"),
    );
    expect(orderCalls).toHaveLength(1);
  });

  it("blocks STAFF and MANAGER roles from accessing customer checkout", () => {
    render(
      <CheckoutView
        initialSession={{
          ...customerSession,
          account: { ...customerSession.account, role: "STAFF" },
        }}
        initialCart={sampleCart}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Không có quyền truy cập",
    );
  });
});
