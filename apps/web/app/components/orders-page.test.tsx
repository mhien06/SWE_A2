import type React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import OrdersPage from "./orders-page";
import { AuthSessionProvider } from "./auth-session";
import { saveSession } from "../lib/api";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("OrdersPage", () => {
  it("shows an empty order history", async () => {
    saveSession({
      accessToken: "test-token",
      user: {
        id: "user-id",
        name: "Customer",
        email: "customer@example.test",
        role: "CUSTOMER",
        pointsBalance: 0,
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => [],
    }));

    render(
      <AuthSessionProvider>
        <OrdersPage />
      </AuthSessionProvider>,
    );

    expect(await screen.findByText("Bạn chưa có đơn hàng nào.")).toBeInTheDocument();
  });
});


describe("Cancelled order amounts", () => {
  it.each([
    { payments: [], pointsRedeemed: 0, text: "Không có tiền VNPay để hoàn hoặc bù điểm.", link: false },
    { payments: [], pointsRedeemed: 10, text: "Không có tiền VNPay để hoàn hoặc bù điểm.", link: true },
    { payments: [{id:"payment",status:"SUCCEEDED",amount:39000}], pointsRedeemed: 0, text: "Đơn đã hủy sau khi thanh toán.", link: true },
    { payments: [{id:"payment",status:"UNKNOWN",amount:39000}], pointsRedeemed: 0, text: "Giao dịch VNPay đang được xác minh", link: false },
  ])("distinguishes payment and point redemption: $text ($pointsRedeemed)", async ({payments,pointsRedeemed,text,link}) => {
    saveSession({accessToken:"test",user:{id:"user",name:"Customer",email:"test@example.test",role:"CUSTOMER",pointsBalance:0}});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok:true,headers:new Headers({"content-type":"application/json"}),json:async()=>({id:"order",orderCode:"BL-test",status:"CANCELLED",createdAt:"2026-11-15T12:00:00Z",totalAmount:39000,vnpayPayableAmount:39000,pointsRedeemed,pointsDiscountAmount:pointsRedeemed*100,items:[],payments})}));
    render(<AuthSessionProvider><OrdersPage orderId="order"/></AuthSessionProvider>);
    expect(await screen.findByText(new RegExp(text))).toBeInTheDocument();
    expect(screen.queryByText("VNPay phải trả")).not.toBeInTheDocument();
    expect(screen.getByText("Còn phải thanh toán")).toHaveTextContent("0đ");
    expect(screen.getByText("Giá trị đơn trước khi hủy")).toHaveTextContent("39.000đ");
    expect(!!screen.queryByRole("link",{name:/Xem lịch sử/})).toBe(link);
  });
});
