import type React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  function staffSession() {
    saveSession({ accessToken: "test-token", user: { id: "staff-id", name: "Staff", email: "staff@example.test", role: "STAFF", pointsBalance: 0 } });
  }
  function response(payload: unknown) {
    return { ok: true, status: 200, headers: new Headers({ "content-type": "application/json" }), json: async () => payload };
  }
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

  it("switches between actionable, reconciliation and history filters", async () => {
    staffSession();
    const fetchMock = vi.fn().mockResolvedValue(response([]));
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthSessionProvider><StaffOrdersPage /></AuthSessionProvider>);
    await screen.findByText("Hiện không có đơn cần xử lý.");
    fireEvent.click(screen.getByRole("button", { name: "Cần đối soát" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/staff/orders?review=true"))).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "200 đơn gần nhất" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/staff/orders?all=true"))).toBe(true));
  });

  it("executes the next valid status action from an order card", async () => {
    staffSession();
    const order = { id: "11111111-1111-4111-8111-111111111111", orderCode: "BL-001", status: "PAID", createdAt: "2026-11-17T00:00:00Z", vnpayPayableAmount: 39000, user: { name: "Khách", email: "customer@example.test" }, items: [{ id: "item", productNameSnapshot: "Bạc xỉu", selectedSizeSnapshot: "S", quantity: 1 }] };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => response(init?.method === "PATCH" ? {} : [order]));
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthSessionProvider><StaffOrdersPage /></AuthSessionProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Chuyển sang Đang pha chế" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => String(url).includes(`/staff/orders/${order.id}/status`) && init?.method === "PATCH")).toBe(true));
  });

  it("requires a cancellation reason beside the paid order and sends it", async () => {
    staffSession();
    const order = { id: "11111111-1111-4111-8111-111111111111", orderCode: "BL-001", status: "PAID", createdAt: "2026-11-17T00:00:00Z", vnpayPayableAmount: 39000, user: { name: "Khách", email: "customer@example.test" }, items: [] };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => response(init?.method === "POST" ? {} : [order]));
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthSessionProvider><StaffOrdersPage /></AuthSessionProvider>);
    const cancel = await screen.findByRole("button", { name: "Hủy đơn đã thanh toán" });
    expect(cancel).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Lý do hủy"), { target: { value: "Khách yêu cầu" } });
    fireEvent.click(cancel);
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => String(url).includes(`/staff/orders/${order.id}/cancel`) && init?.method === "POST" && init.body === JSON.stringify({ reason: "Khách yêu cầu" }))).toBe(true));
  });
});
