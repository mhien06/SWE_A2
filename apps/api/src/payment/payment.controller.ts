import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from "../vnpay/vnpay.types.js";
import { PaymentSettlementService } from "./payment-settlement.service.js";
import { PaymentService } from "./payment.service.js";

interface RequestWithAuth {
  ip?: string;
  user?: { id?: string; sub?: string; role?: string };
  headers?: Record<string, string | string[] | undefined>;
}

function resolveCurrentUserId(req: RequestWithAuth): string {
  const fromGuard = req.user?.id ?? req.user?.sub;
  if (typeof fromGuard === "string" && fromGuard.trim().length > 0) {
    return fromGuard.trim();
  }

  const headerUser = req.headers?.["x-user-id"];
  if (typeof headerUser === "string" && headerUser.trim().length > 0) {
    return headerUser.trim();
  }

  throw new UnauthorizedException({
    code: "UNAUTHORIZED",
    message: "Authentication is required.",
  });
}

@Controller()
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly settlementService: PaymentSettlementService,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
  ) {}

  @Post("payments")
  createPayment(
    @Body() body: { orderId?: string; idempotencyKey?: string } | undefined,
    @Headers("idempotency-key") headerKey: string | undefined,
    @Req() req: RequestWithAuth,
  ) {
    const userId = resolveCurrentUserId(req);
    const orderId = body?.orderId;
    if (typeof orderId !== "string" || !orderId.trim()) {
      throw new BadRequestException({
        code: "INVALID_ORDER_ID",
        message: "orderId is required.",
      });
    }
    const idempotencyKey = headerKey ?? body?.idempotencyKey;
    const ipAddress = req.ip?.replace(/^::ffff:/, "") ?? "127.0.0.1";
    return this.paymentService.createAttempt({
      userId,
      orderId,
      idempotencyKey,
      ipAddress,
    });
  }

  @Post("orders/:id/payments")
  createOrderPayment(
    @Param("id") orderId: string,
    @Body() body: { idempotencyKey?: string; amount?: unknown } | undefined,
    @Headers("idempotency-key") headerKey: string | undefined,
    @Req() req: RequestWithAuth,
  ) {
    const userId = resolveCurrentUserId(req);
    if (body && "amount" in body && body.amount !== undefined) {
      throw new BadRequestException({
        code: "CLIENT_AMOUNT_FORBIDDEN",
        message: "Client must not supply payment amount.",
      });
    }
    const idempotencyKey = headerKey ?? body?.idempotencyKey;
    const ipAddress = req.ip?.replace(/^::ffff:/, "") ?? "127.0.0.1";
    return this.paymentService.createAttempt({
      userId,
      orderId,
      idempotencyKey,
      ipAddress,
    });
  }

  @Get("payments/vnpay/ipn")
  @Header("Cache-Control", "no-store")
  async handleVnpayIpn(@Query() query: Record<string, unknown>) {
    try {
      const evidence = this.gateway.verifyNotification(query);
      if (!evidence) {
        return { RspCode: "97", Message: "Invalid signature or parameters" };
      }
      const result = await this.settlementService.settle(evidence, "IPN");
      const codeMap: Record<typeof result, string> = {
        ACCEPTED: "00",
        DUPLICATE: "02",
        NOT_FOUND: "01",
        INVALID_AMOUNT: "04",
      };
      return { RspCode: codeMap[result], Message: result };
    } catch {
      return { RspCode: "99", Message: "Unable to process notification" };
    }
  }

  @Get("payments/vnpay/return")
  @Header("Cache-Control", "no-store")
  verifyVnpayReturn(@Query() query: Record<string, unknown>) {
    const verified = this.gateway.verifyReturnUrl(query);
    return {
      ...verified,
       authoritative: false,
      message:
        "Return URL chỉ phục vụ điều hướng hiển thị; kết quả cuối cùng phải đọc từ trạng thái đơn/thanh toán trên backend.",
    };
  }

  @Get("payments/:id")
  @Header("Cache-Control", "no-store")
  getPaymentById(@Param("id") paymentId: string, @Req() req: RequestWithAuth) {
    const userId = resolveCurrentUserId(req);
    return this.paymentService.getPaymentById(userId, paymentId);
  }

  @Get("orders/:id/payment-status")
  @Header("Cache-Control", "no-store")
  getOrderPaymentStatus(
    @Param("id") orderId: string,
    @Req() req: RequestWithAuth,
  ) {
    const userId = resolveCurrentUserId(req);
    return this.paymentService.getOrderPaymentStatus(userId, orderId);
  }
}
