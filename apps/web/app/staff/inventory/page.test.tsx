import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InventoryPage from "./page";
const state = vi.hoisted(() => ({ role: "MANAGER", request: vi.fn() }));
vi.mock("../../components/auth-session", () => ({ useAuthSession: () => ({ ready: true, session: { user: { role: state.role, name: "Quản lý kiểm thử" } } }) }));
vi.mock("../../lib/api", () => ({ apiFetch: state.request }));
beforeEach(() => {
  state.role = "MANAGER";
  state.request.mockReset();
  state.request.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method) return {};
    if (path.endsWith("ingredients")) return [{ id: "ingredient-id", name: "Sữa", unit: "MILLILITER", quantityOnHand: "5", reorderLevel: "10", isActive: true }];
    if (path.includes("history")) return [{ id: "movement-id", type: "RESTORE", ingredient: "Sữa", unit: "MILLILITER", delta: 7, at: "2026-11-15T12:00:00Z", actor: "Quản lý kiểm thử", reason: "Hủy trước pha", orderId: "order-id" }];
    return [];
  });
});
afterEach(cleanup);
describe("Manager inventory UI", () => {
  it("prevents staff from loading privileged inventory endpoints", () => {
    state.role = "STAFF"; render(<InventoryPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("Chỉ quản lý");
    expect(state.request).not.toHaveBeenCalled();
  });
  it("shows low stock and sends the signed adjustment with its reason", async () => {
    render(<InventoryPage />);
    await screen.findByText("Sữa", { selector: "h2" });
    expect(screen.getByText(/1 nguyên liệu chạm/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Điều chỉnh Sữa"), { target: { value: "-2" } });
    fireEvent.change(screen.getByLabelText("Lý do", { exact: true }), { target: { value: "Kiểm kê" } });
    fireEvent.submit(screen.getByRole("button", { name: "Lưu điều chỉnh" }).closest("form")!);
    await waitFor(() => expect(state.request).toHaveBeenCalledWith("/staff/inventory/ingredients/ingredient-id/stock", { method: "PATCH", body: JSON.stringify({ quantityDelta: -2, reason: "Kiểm kê" }) }));
  });
  it("shows restoration history with actor and related order", async () => {
    render(<InventoryPage />);
    await screen.findByText("Sữa", { selector: "h2" });
    fireEvent.click(screen.getByRole("button", { name: "Lịch sử kho" }));
    expect(screen.getByText("Sữa · Hoàn kho")).toBeInTheDocument();
    expect(screen.getByText("Mã đơn: order-id")).toBeInTheDocument();
    expect(screen.getByText("Hủy trước pha")).toBeInTheDocument();
  });
});
