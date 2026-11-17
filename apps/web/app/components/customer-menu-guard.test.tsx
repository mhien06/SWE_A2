import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import CustomerMenuGuard from "./customer-menu-guard";

const state = vi.hoisted(() => ({ role: "STAFF", replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: state.replace }) }));
vi.mock("./auth-session", () => ({ useAuthSession: () => ({ ready: true, session: { user: { role: state.role } } }) }));

beforeEach(() => { state.role = "STAFF"; state.replace.mockReset(); });

it("redirects staff away from customer menu content", async () => {
  render(<CustomerMenuGuard><p>Customer menu</p></CustomerMenuGuard>);
  expect(screen.queryByText("Customer menu")).not.toBeInTheDocument();
  await waitFor(() => expect(state.replace).toHaveBeenCalledWith("/staff/orders"));
});

it("redirects managers to product administration", async () => {
  state.role = "MANAGER";
  render(<CustomerMenuGuard><p>Customer menu</p></CustomerMenuGuard>);
  await waitFor(() => expect(state.replace).toHaveBeenCalledWith("/manager/products"));
});
