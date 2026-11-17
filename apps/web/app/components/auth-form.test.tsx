import type React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AuthForm from "./auth-form";
import { AuthSessionProvider } from "./auth-session";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: navigation.push }) }));

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
  navigation.push.mockReset();
});

describe("AuthForm", () => {
  it("shows a clear server error without exposing credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ message: "Invalid email or password" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AuthSessionProvider>
        <AuthForm mode="login" />
      </AuthSessionProvider>,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "customer@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), {
      target: { value: "incorrect-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password",
    );
    expect(document.body.textContent).not.toContain("incorrect-password");
  });

  it("sends staff and managers to their workspace instead of the customer menu", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ accessToken: "token", user: { id: "staff", name: "Staff", email: "staff@example.test", role: "STAFF", pointsBalance: 0 } }),
    }));
    render(<AuthSessionProvider><AuthForm mode="login" /></AuthSessionProvider>);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "staff@example.test" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "strong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/staff/orders"));
  });
});
