import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VnpayGateway, vnpayDate } from "./vnpay.gateway.js";

const secret = "unit-test-only-vnpay-sandbox-secret";
const hmac = (data: string) =>
  createHmac("sha512", secret).update(data, "utf8").digest("hex");

const sampleRequest = {
  orderId: "11111111-2222-4333-8444-555555555555",
  transactionRef: "TXN202611150001",
  amount: 29050,
  ipAddress: "127.0.0.1",
  createdAt: new Date("2026-11-15T10:00:00Z"),
  expiresAt: new Date("2026-11-15T10:05:00Z"),
};

function signedNotification(overrides: Record<string, string> = {}) {
  const data: Record<string, string> = {
    vnp_TmnCode: "TESTCODE",
    vnp_TxnRef: sampleRequest.transactionRef,
    vnp_Amount: String(sampleRequest.amount * 100),
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TransactionNo: "12345678",
    vnp_PayDate: "20261115170200",
    vnp_BankCode: "NCB",
    ...overrides,
  };
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  const query = entries
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value).replace(/%20/g, "+")}`,
    )
    .join("&");
  return { ...data, vnp_SecureHash: hmac(query) };
}

describe("VnpayGateway", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  let gateway: VnpayGateway;

  beforeEach(() => {
    process.env.VNP_TMN_CODE = "TESTCODE";
    process.env.VNP_HASH_SECRET = secret;
    process.env.VNP_PAY_URL =
      "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    process.env.VNP_API_URL =
      "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction";
    process.env.VNP_RETURN_URL = "http://localhost:3000/payment/return";
    gateway = new VnpayGateway();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  it("signs URL parameters with HMAC-SHA512, multiplies amount by 100 and formats GMT+7 dates", () => {
    const url = new URL(gateway.createPaymentUrl(sampleRequest));
    const signature = url.searchParams.get("vnp_SecureHash");
    const rawSignedData = url.search.slice(1).split("&vnp_SecureHash=")[0];

    expect(signature).toBe(hmac(rawSignedData));
    expect(url.searchParams.get("vnp_Amount")).toBe("2905000");
    expect(url.searchParams.get("vnp_CreateDate")).toBe("20261115170000");
    expect(url.searchParams.get("vnp_ExpireDate")).toBe("20261115170500");
    expect(
      new URL(url.searchParams.get("vnp_ReturnUrl")!).searchParams.get(
        "orderId",
      ),
    ).toBe(sampleRequest.orderId);
    expect(vnpayDate(new Date("2026-12-31T20:00:00Z"))).toBe("20270101030000");
  });

  it("rejects placeholder secrets or non-sandbox URLs", () => {
    process.env.VNP_HASH_SECRET = "replace-with-sandbox-hash-secret";
    expect(() => gateway.createPaymentUrl(sampleRequest)).toThrow();

    process.env.VNP_HASH_SECRET = secret;
    process.env.VNP_PAY_URL = "https://pay.vnpay.vn/vpcpay.html";
    expect(() => gateway.createPaymentUrl(sampleRequest)).toThrow();
  });

  it("verifies IPN signature, merchant code, amount format and maps SUCCEEDED/FAILED/EXPIRED/UNKNOWN", () => {
    const valid = signedNotification();
    expect(gateway.verifyNotification(valid)?.status).toBe("SUCCEEDED");

    expect(
      gateway.verifyNotification({ ...valid, vnp_Amount: "100" }),
    ).toBeNull();
    expect(
      gateway.verifyNotification({
        ...valid,
        vnp_TxnRef: ["TXN202611150001", "DUP"],
      }),
    ).toBeNull();
    expect(
      gateway.verifyNotification({ ...valid, vnp_SecureHash: "invalid" }),
    ).toBeNull();
    expect(
      gateway.verifyNotification(
        signedNotification({ vnp_TmnCode: "OTHERMER" }),
      ),
    ).toBeNull();
    expect(
      gateway.verifyNotification(
        signedNotification({ vnp_Amount: "2905001" }),
      ),
    ).toBeNull();
    expect(
      gateway.verifyNotification(
        signedNotification({ vnp_TransactionNo: "0" }),
      ),
    ).toBeNull();

    expect(
      gateway.verifyNotification(
        signedNotification({
          vnp_ResponseCode: "24",
          vnp_TransactionStatus: "02",
        }),
      )?.status,
    ).toBe("FAILED");

    expect(
      gateway.verifyNotification(
        signedNotification({
          vnp_ResponseCode: "11",
          vnp_TransactionStatus: "02",
        }),
      )?.status,
    ).toBe("EXPIRED");

    for (const status of ["01", "04", "05", "06", "07", "09", "99"]) {
      expect(
        gateway.verifyNotification(
          signedNotification({ vnp_TransactionStatus: status }),
        )?.status,
      ).toBe("UNKNOWN");
    }
  });

  it("verifies Return URL signature without trusting it as settlement proof", () => {
    const signed = signedNotification();
    const verified = gateway.verifyReturnUrl({
      ...signed,
      orderId: sampleRequest.orderId,
    });
    expect(verified.validSignature).toBe(true);
    expect(verified.orderId).toBe(sampleRequest.orderId);

    const tampered = gateway.verifyReturnUrl({
      ...signed,
      vnp_ResponseCode: "24",
      orderId: sampleRequest.orderId,
    });
    expect(tampered.validSignature).toBe(false);
  });

  it("verifies QueryDR pipe-delimited signature and never treats network/format errors as FAILED", async () => {
    const baseResponse: Record<string, string> = {
      vnp_ResponseId: "resp001",
      vnp_Command: "querydr",
      vnp_ResponseCode: "00",
      vnp_Message: "Success",
      vnp_TmnCode: "TESTCODE",
      vnp_TxnRef: sampleRequest.transactionRef,
      vnp_Amount: String(sampleRequest.amount * 100),
      vnp_BankCode: "NCB",
      vnp_PayDate: "20261115170200",
      vnp_TransactionNo: "12345678",
      vnp_TransactionType: "01",
      vnp_TransactionStatus: "00",
      vnp_OrderInfo: `Thanh toan don hang ${sampleRequest.orderId}`,
      vnp_PromotionCode: "",
      vnp_PromotionAmount: "",
    };

    let corruptSignature = false;
    globalThis.fetch = (async (_url, options) => {
      const body = JSON.parse(options!.body as string) as Record<
        string,
        string
      >;
      const expectedReqHash = hmac(
        [
          body.vnp_RequestId,
          "2.1.0",
          "querydr",
          "TESTCODE",
          sampleRequest.transactionRef,
          "20261115170000",
          body.vnp_CreateDate,
          "127.0.0.1",
          `Truy van don hang ${sampleRequest.orderId}`,
        ].join("|"),
      );
      expect(body.vnp_SecureHash).toBe(expectedReqHash);

      const responseHash = corruptSignature
        ? "0".repeat(128)
        : hmac(Object.values(baseResponse).join("|"));
      return Response.json({
        ...baseResponse,
        vnp_SecureHash: responseHash,
      });
    }) as typeof fetch;

    expect((await gateway.queryTransaction(sampleRequest))?.status).toBe(
      "SUCCEEDED",
    );

    corruptSignature = true;
    expect(await gateway.queryTransaction(sampleRequest)).toBeNull();
    corruptSignature = false;

    baseResponse.vnp_TransactionStatus = "02";
    expect((await gateway.queryTransaction(sampleRequest))?.status).toBe(
      "FAILED",
    );

    baseResponse.vnp_TransactionStatus = "01";
    expect((await gateway.queryTransaction(sampleRequest))?.status).toBe(
      "UNKNOWN",
    );

    globalThis.fetch = (async () => {
      throw new Error("network timeout");
    }) as typeof fetch;
    expect(await gateway.queryTransaction(sampleRequest)).toBeNull();
  });
});
