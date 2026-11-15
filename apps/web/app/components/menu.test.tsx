import type React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Menu from "./menu";

vi.mock("next/image", () => ({
  default: ({ fill, priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    void fill;
    void priority;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} />;
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Menu", () => {
  it("shows loading then renders products from the API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        id: "11111111-1111-4111-8111-111111111111",
        name: "Cà phê sữa",
        description: "Cà phê và sữa đặc",
        basePrice: 29000,
        isAvailable: true,
      }],
    }));

    render(<Menu />);
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải thực đơn");
    expect(await screen.findByText("Cà phê sữa")).toBeInTheDocument();
    expect(screen.getByText("30.000đ")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }));

    render(<Menu />);
    expect(await screen.findByText("Thực đơn chưa có món.")).toBeInTheDocument();
  });

  it("shows an error and retries the request", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    render(<Menu />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được menu");

    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Thực đơn chưa có món.")).toBeInTheDocument();
  });
});
