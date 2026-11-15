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
