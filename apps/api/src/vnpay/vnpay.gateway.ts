import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type {
  PaymentEvidence,
  PaymentGateway,
  PaymentGatewayRequest,
  ReturnUrlVerificationResult,
} from "./vnpay.types.js";

/**
 * VNPay yêu cầu thời gian theo múi giờ GMT+7 (YYYYMMDDHHmmss),
 * độc lập với múi giờ hệ điều hành của container/server.
 */
export function vnpayDate(date: Date): string {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace(/[-T:]/g, "");
}

export function signVnpay(data: string, secret: string): string {
  return createHmac("sha512", secret).update(data, "utf8").digest("hex");
}

export function encodeVnpay(parameters: Record<string, string>): string {
  const encode = (value: string) =>
    encodeURIComponent(value).replace(/%20/g, "+");
  return Object.keys(parameters)
    .sort()
    .map((key) => `${encode(key)}=${encode(parameters[key])}`)
    .join("&");
}

function validSignature(
  data: string,
  signature: string,
  secret: string,
): boolean {
  if (!/^[a-f0-9]{128}$/i.test(signature)) {
    return false;
  }
  const expected = Buffer.from(signVnpay(data, secret), "hex");
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

function stringParameters(
  input: Record<string, unknown>,
): Record<string, string> | null {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "string" || value.length > 2048) {
      return null;
    }
    result[key] = value;
  }
  return result;
}

const queryResponseFields = [
  "vnp_ResponseId",
  "vnp_Command",
  "vnp_ResponseCode",
  "vnp_Message",
  "vnp_TmnCode",
  "vnp_TxnRef",
  "vnp_Amount",
  "vnp_BankCode",
  "vnp_PayDate",
  "vnp_TransactionNo",
  "vnp_TransactionType",
  "vnp_TransactionStatus",
  "vnp_OrderInfo",
  "vnp_PromotionCode",
  "vnp_PromotionAmount",
];

const definiteFailureCodes = [
  "09",
  "10",
  "11",
  "12",
  "13",
  "24",
  "51",
  "65",
  "75",
  "79",
  "99",
];

@Injectable()
export class VnpayGateway implements PaymentGateway {
  private configuration() {
    const tmnCode = process.env.VNP_TMN_CODE ?? process.env.VNPAY_TMN_CODE;
    const secret = process.env.VNP_HASH_SECRET ?? process.env.VNPAY_HASH_SECRET;
    const paymentUrl =
      process.env.VNP_PAY_URL ?? process.env.VNPAY_PAYMENT_URL;
    const queryUrl = process.env.VNP_API_URL ?? process.env.VNPAY_QUERY_URL;
    const returnUrl =
      process.env.VNP_RETURN_URL ?? process.env.VNPAY_RETURN_URL;

    if (
      !tmnCode ||
      !secret ||
      !paymentUrl ||
      !queryUrl ||
      !returnUrl ||
      !/^[A-Za-z0-9_]{4,16}$/.test(tmnCode) ||
      /^(replace|your|placeholder)/i.test(secret)
    ) {
      throw new ServiceUnavailableException({
        code: "PAYMENT_NOT_CONFIGURED",
        message: "VNPay Sandbox is not configured.",
      });
    }

    try {
      for (const address of [paymentUrl, queryUrl]) {
        const url = new URL(address);
        if (
          url.protocol !== "https:" ||
          url.hostname !== "sandbox.vnpayment.vn" ||
          url.username ||
          url.password ||
          url.search ||
          url.hash
        ) {
          throw new Error("Invalid VNPay Sandbox endpoint");
        }
      }
      const parsedReturnUrl = new URL(returnUrl);
      if (
        !["http:", "https:"].includes(parsedReturnUrl.protocol) ||
        parsedReturnUrl.username ||
        parsedReturnUrl.password ||
        parsedReturnUrl.hash
      ) {
        throw new Error("Invalid Return URL");
      }
    } catch {
      throw new ServiceUnavailableException({
        code: "PAYMENT_NOT_CONFIGURED",
        message: "Invalid VNPay Sandbox URLs.",
      });
    }

    return { tmnCode, secret, paymentUrl, queryUrl, returnUrl };
  }

  createPaymentUrl(request: PaymentGatewayRequest): string {
    const config = this.configuration();
    if (
      !Number.isSafeInteger(request.amount) ||
      request.amount <= 0 ||
      request.amount * 100 > 999_999_999_999
    ) {
      throw new ServiceUnavailableException("Unsupported payment amount.");
    }

    const returnUrl = new URL(config.returnUrl);
    returnUrl.searchParams.set("orderId", String(request.orderId));

    const parameters: Record<string, string> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: config.tmnCode,
      vnp_Amount: String(request.amount * 100),
      vnp_CurrCode: "VND",
      vnp_TxnRef: request.transactionRef,
      vnp_OrderInfo: `Thanh toan don hang ${request.orderId}`,
      vnp_OrderType: "other",
      vnp_Locale: "vn",
      vnp_ReturnUrl: returnUrl.toString(),
      vnp_IpAddr: isIP(request.ipAddress) ? request.ipAddress : "127.0.0.1",
      vnp_CreateDate: vnpayDate(request.createdAt),
      vnp_ExpireDate: vnpayDate(request.expiresAt),
    };

    const data = encodeVnpay(parameters);
    const signature = signVnpay(data, config.secret);
    return `${config.paymentUrl}?${data}&vnp_SecureHash=${signature}`;
  }

  verifyNotification(query: Record<string, unknown>): PaymentEvidence | null {
    const parameters = stringParameters(query);
    if (!parameters) {
      return null;
    }

    const signature = parameters.vnp_SecureHash ?? "";
    const signedParams: Record<string, string> = { ...parameters };
    delete signedParams.vnp_SecureHash;
    delete signedParams.vnp_SecureHashType;
    delete signedParams.orderId;

    const config = this.configuration();
    if (!validSignature(encodeVnpay(signedParams), signature, config.secret)) {
      return null;
    }
    if (signedParams.vnp_TmnCode !== config.tmnCode) {
      return null;
    }

    return this.readEvidence(signedParams, false);
  }

  /**
   * Return URL chỉ dùng để điều hướng/hiển thị sơ bộ; tuyệt đối không dùng để chốt PAID.
   */
  verifyReturnUrl(
    query: Record<string, unknown>,
  ): ReturnUrlVerificationResult {
    const parameters = stringParameters(query);
    if (!parameters) {
      return {
        validSignature: false,
        orderId: null,
        transactionRef: null,
        responseCode: null,
        transactionStatus: null,
      };
    }

    const orderId = parameters.orderId ?? null;
    const transactionRef = parameters.vnp_TxnRef ?? null;
    const responseCode = parameters.vnp_ResponseCode ?? null;
    const transactionStatus = parameters.vnp_TransactionStatus ?? null;
    const signature = parameters.vnp_SecureHash ?? "";

    const signedParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(parameters)) {
      if (
        key.startsWith("vnp_") &&
        key !== "vnp_SecureHash" &&
        key !== "vnp_SecureHashType"
      ) {
        signedParams[key] = value;
      }
    }

    try {
      const config = this.configuration();
      const isValid =
        validSignature(encodeVnpay(signedParams), signature, config.secret) &&
        signedParams.vnp_TmnCode === config.tmnCode;
      return {
        validSignature: isValid,
        orderId,
        transactionRef,
        responseCode,
        transactionStatus,
      };
    } catch {
      return {
        validSignature: false,
        orderId,
        transactionRef,
        responseCode,
        transactionStatus,
      };
    }
  }

  async queryTransaction(
    request: PaymentGatewayRequest,
  ): Promise<PaymentEvidence | null> {
    const config = this.configuration();
    const ipAddress = process.env.VNPAY_QUERY_IP ?? "127.0.0.1";
    if (!isIP(ipAddress)) {
      return null;
    }

    const parameters: Record<string, string> = {
      vnp_RequestId: randomUUID().replace(/-/g, ""),
      vnp_Version: "2.1.0",
      vnp_Command: "querydr",
      vnp_TmnCode: config.tmnCode,
      vnp_TxnRef: request.transactionRef,
      vnp_TransactionDate: vnpayDate(request.createdAt),
      vnp_CreateDate: vnpayDate(new Date()),
      vnp_IpAddr: ipAddress,
      vnp_OrderInfo: `Truy van don hang ${request.orderId}`,
    };

    parameters.vnp_SecureHash = signVnpay(
      Object.values(parameters).join("|"),
      config.secret,
    );

    try {
      const response = await fetch(config.queryUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parameters),
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
      });
      if (!response.ok) {
        return null;
      }

      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return null;
      }

      const result = stringParameters(body as Record<string, unknown>);
      if (!result) {
        return null;
      }

      const data = queryResponseFields
        .map((field) => result[field] ?? "")
        .join("|");
      if (!validSignature(data, result.vnp_SecureHash ?? "", config.secret)) {
        return null;
      }

      if (
        result.vnp_TmnCode !== config.tmnCode ||
        result.vnp_Command !== "querydr" ||
        result.vnp_ResponseCode !== "00" ||
        result.vnp_TransactionType !== "01" ||
        result.vnp_TxnRef !== request.transactionRef
      ) {
        return null;
      }

      const evidence = this.readEvidence(result, true);
      if (!evidence || evidence.amount !== request.amount) {
        return null;
      }
      return evidence;
    } catch {
      // Lỗi mạng, timeout hoặc phản hồi không hợp lệ không được coi là giao dịch FAILED.
      return null;
    }
  }

  private readEvidence(
    parameters: Record<string, string>,
    isQuery: boolean,
  ): PaymentEvidence | null {
    if (
      !/^[A-Za-z0-9_-]{1,100}$/.test(parameters.vnp_TxnRef ?? "") ||
      !/^\d{1,12}$/.test(parameters.vnp_Amount ?? "") ||
      !/^\d{2}$/.test(parameters.vnp_ResponseCode ?? "") ||
      !/^\d{2}$/.test(parameters.vnp_TransactionStatus ?? "")
    ) {
      return null;
    }

    const amount = Number(parameters.vnp_Amount) / 100;
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return null;
    }

    const responseCode = parameters.vnp_ResponseCode;
    const transactionStatus = parameters.vnp_TransactionStatus;
    let status: PaymentEvidence["status"] = "UNKNOWN";

    if (responseCode === "00" && transactionStatus === "00") {
      if (
        !/^[1-9]\d{0,14}$/.test(parameters.vnp_TransactionNo ?? "") ||
        !/^\d{14}$/.test(parameters.vnp_PayDate ?? "")
      ) {
        return null;
      }
      status = "SUCCEEDED";
    } else if (
      transactionStatus === "02" &&
      (isQuery || definiteFailureCodes.includes(responseCode))
    ) {
      status = !isQuery && responseCode === "11" ? "EXPIRED" : "FAILED";
    }

    return {
      transactionRef: parameters.vnp_TxnRef,
      amount,
      status,
      responseCode,
      transactionStatus,
      providerTransactionNo: parameters.vnp_TransactionNo ?? "",
      bankCode: parameters.vnp_BankCode ?? "",
      payDate: parameters.vnp_PayDate ?? "",
    };
  }
}
