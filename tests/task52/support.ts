import { Test } from "@nestjs/testing";
import { ValidationPipe } from "@nestjs/common";
import { randomUUID, createHmac } from "node:crypto";
import request from "supertest";
import { AppModule } from "../../apps/api/src/app.module.js";
import { PrismaService } from "../../apps/api/src/prisma/prisma.service.js";
import { PAYMENT_GATEWAY } from "../../apps/api/src/vnpay/vnpay.types.js";
import { VnpayGateway } from "../../apps/api/src/vnpay/vnpay.gateway.js";

export const testSecret = "task52-local-test-signing-secret";
export async function startTestApp() {
  const url = process.env.TASK52_DATABASE_URL;
  if (
    !url ||
    !/^brewlite_task52_test(?:_[a-z0-9]+)?$/.test(
      new URL(url).pathname.slice(1),
    )
  ) {
    throw new Error(
      "TASK52_DATABASE_URL must point to an isolated brewlite_task52_test database",
    );
  }
  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "task52-only-jwt-secret-with-at-least-32-characters";
  process.env.VNP_TMN_CODE = "TESTCODE";
  process.env.VNP_HASH_SECRET = testSecret;
  process.env.VNP_PAY_URL =
    "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
  process.env.VNP_API_URL =
    "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction";
  process.env.VNP_RETURN_URL = "http://localhost:3320/payment/return";
  process.env.LOYALTY_EARN_POINTS_PER_VND = "0.001";
  process.env.LOYALTY_EARN_ROUNDING = "FLOOR";
  process.env.LOYALTY_REDEEM_VND_PER_POINT = "100";
  // Real signature verification and payment URL creation. QueryDR never calls VNPay.
  const gateway = new VnpayGateway();
  gateway.queryTransaction = async () => null;
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PAYMENT_GATEWAY)
    .useValue(gateway)
    .compile();
  const app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({ origin: "http://localhost:3320" });
  await app.init();
  const db = app.get(PrismaService);
  const http = request(app.getHttpServer());
  return { app, db, http, gateway };
}
export type TestApp = Awaited<ReturnType<typeof startTestApp>>;

export async function customer(context: TestApp) {
  const email = `${randomUUID()}@task52.test`;
  const password = "Task52-test-password!";
  const response = await context.http
    .post("/auth/register")
    .send({ name: "Task 5.2", email, password })
    .expect(201);
  return {
    ...response.body,
    email,
    password,
    authorization: `Bearer ${response.body.accessToken}`,
  };
}

export async function cart(context: TestApp, authorization: string) {
  const product = await context.db.product.findUniqueOrThrow({
    where: { id: "11111111-1111-4111-8111-111111111111" },
    include: { options: true },
  });
  await context.http
    .post("/cart/items")
    .set("Authorization", authorization)
    .send({
      productId: product.id,
      sizeOptionId: product.options.find(
        (option) => option.type === "SIZE" && option.name === "M",
      )!.id,
      toppingOptionIds: [
        product.options.find(
          (option) => option.type === "TOPPING" && option.name === "Trân châu",
        )!.id,
      ],
      quantity: 1,
    })
    .expect(201);
}

export async function orderAndPayment(context: TestApp) {
  const user = await customer(context);
  await cart(context, user.authorization);
  const order = (
    await context.http
      .post("/orders")
      .set("Authorization", user.authorization)
      .send({})
      .expect(201)
  ).body;
  const key = randomUUID();
  const payment = (
    await context.http
      .post(`/orders/${order.id}/payments`)
      .set("Authorization", user.authorization)
      .set("Idempotency-Key", key)
      .send({})
      .expect(201)
  ).body;
  return { user, order, payment, key };
}

export function signedIpn(
  payment: { transactionRef: string; amount: number },
  overrides: Record<string, string> = {},
) {
  const fields = {
    vnp_TmnCode: "TESTCODE",
    vnp_TxnRef: payment.transactionRef,
    vnp_Amount: String(payment.amount * 100),
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TransactionNo: "12345678",
    vnp_PayDate: "20261115171500",
    vnp_BankCode: "NCB",
    ...overrides,
  };
  const encoded = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value).replace(/%20/g, "+")}`,
    )
    .join("&");
  return `${encoded}&vnp_SecureHash=${createHmac("sha512", testSecret).update(encoded).digest("hex")}`;
}
