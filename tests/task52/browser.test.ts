import {
  chromium,
  expect as browserExpect,
  type Browser,
} from "@playwright/test";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync, createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { customer, signedIpn, startTestApp, type TestApp } from "./support.js";

describe("Task 5.2 browser E2E / real Web + API + PostgreSQL / simulated VNPay", () => {
  let context: TestApp;
  let browser: Browser;
  let web: ChildProcess;
  const artifacts = resolve("../../tests/artifacts/task52");
  beforeAll(async () => {
    mkdirSync(artifacts, { recursive: true });
    context = await startTestApp();
    await context.app.listen(3321, "127.0.0.1");
    const log = createWriteStream(resolve(artifacts, "next.log"));
    web = spawn(
      process.execPath,
      [
        resolve("../web/node_modules/next/dist/bin/next"),
        "dev",
        "--port",
        "3320",
      ],
      {
        cwd: resolve("../web"),
        windowsHide: true,
        env: {
          ...process.env,
          NODE_ENV: "development",
          NEXT_TELEMETRY_DISABLED: "1",
          NEXT_PUBLIC_API_URL: "http://localhost:3321",
          API_INTERNAL_URL: "http://127.0.0.1:3321",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    web.stdout!.pipe(log);
    web.stderr!.pipe(log);
    let ready = false;
    for (let attempt = 0; attempt < 90; attempt++) {
      if (web.exitCode !== null)
        throw new Error(
          "Next server exited; see tests/artifacts/task52/next.log",
        );
      try {
        const response = await fetch("http://localhost:3320", {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        /* Wait for the test-owned server. */
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error("Next server did not become ready");
    browser = await chromium.launch({ headless: true });
  }, 120000);
  afterAll(async () => {
    await browser?.close();
    if (web?.pid) {
      if (process.platform === "win32")
        spawnSync("taskkill", ["/pid", String(web.pid), "/T", "/F"], {
          windowsHide: true,
        });
      else web.kill("SIGTERM");
    }
    await context?.app.close();
  });

  it("opens menu, selects options, logs in, creates cart/order and sees verified payment", async () => {
    const user = await customer(context);
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);
    try {
      await page.goto("http://localhost:3320");
      await page
        .locator('a[href="/products/11111111-1111-4111-8111-111111111111"]')
        .first()
        .click();
      await page
        .getByLabel("Kích thước")
        .selectOption({ label: "M (+5.000đ)" });
      await page.getByLabel("Trân châu", { exact: false }).check();
      // Current product requires login BEFORE adding to the server cart.
      await page
        .getByRole("link", { name: "Đăng nhập để thêm vào giỏ" })
        .click();
      await page.getByLabel("Email", { exact: true }).fill(user.email);
      await page.getByLabel("Mật khẩu", { exact: true }).fill(user.password);
      await page
        .getByRole("button", { name: "Đăng nhập", exact: true })
        .click();
      await page.waitForURL("http://localhost:3320/");
      await page
        .locator('a[href="/products/11111111-1111-4111-8111-111111111111"]')
        .first()
        .click();
      await page
        .getByLabel("Kích thước")
        .selectOption({ label: "M (+5.000đ)" });
      await page.getByLabel("Trân châu", { exact: false }).check();
      await page
        .getByRole("button", { name: "Thêm vào giỏ", exact: true })
        .click();
      await page.waitForURL("**/cart");
      await page
        .getByRole("button", { name: "Xem giá chính thức", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Xác nhận và tạo đơn", exact: true })
        .click();
      await page.waitForURL(/\/orders\/[0-9a-f-]+$/);
      const orderId = page.url().split("/").at(-1)!;
      // Intercept only the external provider navigation. All application requests hit the real API/DB.
      await page.route("https://sandbox.vnpayment.vn/**", async (route) => {
        const payment = await context.db.payment.findFirstOrThrow({
          where: { orderId },
        });
        const ipn = await context.http
          .get(`/payments/vnpay/ipn?${signedIpn(payment)}`)
          .expect(200);
        expect(ipn.body.RspCode).toBe("00");
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<h1>Simulated payment provider</h1>",
        });
      });
      await page
        .getByRole("link", { name: "Tiếp tục thanh toán", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Thanh toán VNPay", exact: true })
        .click();
      await browserExpect(
        page.getByRole("heading", { name: "Simulated payment provider" }),
      ).toBeVisible();
      await page.goto(`http://localhost:3320/orders/${orderId}`);
      await browserExpect(
        page.getByText("Đã thanh toán", { exact: true }).first(),
      ).toBeVisible();
      expect(
        (await context.db.order.findUniqueOrThrow({ where: { id: orderId } }))
          .totalAmount,
      ).toBe(42000);
      expect(
        (await context.db.order.findUniqueOrThrow({ where: { id: orderId } }))
          .status,
      ).toBe("PAID");
      await page.screenshot({
        path: resolve(artifacts, "checkout-paid.png"),
        fullPage: true,
      });
    } catch (error) {
      await page
        .screenshot({
          path: resolve(artifacts, "checkout-failure.png"),
          fullPage: true,
        })
        .catch(() => {});
      throw error;
    } finally {
      await page.close();
    }
  }, 120000);
});
