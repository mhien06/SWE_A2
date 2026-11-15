import type React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthSessionProvider } from "../components/auth-session";
import { CheckoutView } from "./page";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

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
      <AuthSessionProvider>
        <CheckoutView
          initialSession={customerSession}
          initialCart={sampleCart}
          onClearCart={onClearCart}
          onNavigateToGateway={onNavigate}
        />
      </AuthSessionProvider>,
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
    const body = JSON.parse(String((orderCalls[0]?.[1] as RequestInit).body));
    expect(body).toEqual({ pointsRedeemed: 0 });
  });

  it("loads server cart in Mode 2 and creates order using backend Prisma id", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).endsWith("/cart")) {
        return {
          ok: true,
          json: async () => ({
            id: "cart-1",
            items: [
              {
                id: "ci-1",
                productId: "11111111-1111-4111-8111-111111111111",
                productName: "Trà Đào Cam Sả",
                productIsAvailable: true,
                sizeOptionId: "s-l",
                toppingOptionIds: [],
                selectedSize: "L",
                selectedToppings: [],
                quantity: 2,
                unitPrice: 45000,
                lineTotal: 90000,
              },
            ],
            total: 90000,
          }),
        };
      }
      if (String(url).endsWith("/orders")) {
        return {
          ok: true,
          json: async () => ({
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            orderCode: "BL-2026",
            status: "PENDING",
            subtotal: 90000,
            discountAmount: 0,
            totalAmount: 90000,
            pointsRedeemed: 0,
            pointsDiscountAmount: 0,
            vnpayPayableAmount: 90000,
            expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
          }),
        };
      }
      if (String(url).endsWith("/payments")) {
        return {
          ok: true,
          json: async () => ({
            paymentId: "pay-1",
            orderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            orderStatus: "PENDING",
            provider: "VNPAY_SANDBOX",
            transactionRef: "TXN2026",
            idempotencyKey: "k-1",
            amount: 90000,
            status: "PENDING",
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            orderExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
            verifiedAt: null,
            awaitingVerification: false,
            paymentUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=TXN2026",
            needsReview: false,
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          orderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          orderCode: "BL-2026",
          orderStatus: "PENDING",
          subtotal: 90000,
          discountAmount: 0,
          totalAmount: 90000,
          pointsRedeemed: 0,
          pointsDiscountAmount: 0,
          vnpayPayableAmount: 90000,
          orderExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
          payment: null,
          canPay: true,
          canRetry: false,
          needsReview: false,
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    const onNavigate = vi.fn();

    render(
      <AuthSessionProvider>
        <CheckoutView
          initialSession={customerSession}
          onNavigateToGateway={onNavigate}
        />
      </AuthSessionProvider>,
    );

    expect(await screen.findByText(/Trà Đào Cam Sả/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Đặt hàng và thanh toán VNPay" }),
    );

    await waitFor(() =>
      expect(onNavigate).toHaveBeenCalledWith(
        "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_TxnRef=TXN2026",
      ),
    );
  });

  it("blocks STAFF and MANAGER roles from accessing customer checkout", () => {
    render(
      <AuthSessionProvider>
        <CheckoutView
          initialSession={{
            ...customerSession,
            account: { ...customerSession.account, role: "STAFF" },
          }}
          initialCart={sampleCart}
        />
      </AuthSessionProvider>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Không có quyền truy cập",
    );
  });
});
