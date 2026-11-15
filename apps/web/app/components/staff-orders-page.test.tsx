import type React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StaffOrdersPage from "./staff-orders-page";
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

describe("StaffOrdersPage", () => {
  it("shows the empty operations state for staff", async () => {
    saveSession({
      accessToken: "test-token",
      user: {
        id: "staff-id",
        name: "Staff",
        email: "staff@example.test",
        role: "STAFF",
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
        <StaffOrdersPage />
      </AuthSessionProvider>,
    );

    expect(await screen.findByText("Hiện không có đơn cần xử lý.")).toBeInTheDocument();
  });
});
