import type React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CartPage from "./cart-page";
import { AuthSessionProvider } from "./auth-session";
import { saveSession } from "../lib/api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

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

describe("CartPage", () => {
  it("shows an empty state from the real cart API response", async () => {
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
      json: async () => ({ id: "cart-id", items: [], total: 0 }),
    }));

    render(
      <AuthSessionProvider>
        <CartPage />
      </AuthSessionProvider>,
    );

    expect(await screen.findByText("Giỏ hàng đang trống.")).toBeInTheDocument();
  });
});
