import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from "../vnpay/vnpay.types.js";
import {
  CreateOrderPaymentDto,
  CreatePaymentDto,
} from "./dto/payment.dto.js";
import { PaymentSettlementService } from "./payment-settlement.service.js";
import { PaymentService } from "./payment.service.js";

@Controller()
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly settlementService: PaymentSettlementService,
    @Inject(PAYMENT_GATEWAY)
    private readonly gateway: PaymentGateway,
  ) {}

  @Post("payments")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CUSTOMER")
  createPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePaymentDto,
    @Headers("idempotency-key") headerKey: string | undefined,
    @Req() req: Request,
  ) {
    if ("amount" in (body as object)) {
      throw new BadRequestException({
        code: "CLIENT_AMOUNT_FORBIDDEN",
        message: "Client must not supply payment amount.",
      });
    }
    const idempotencyKey = headerKey ?? body.idempotencyKey;
    const ipAddress = req.ip?.replace(/^::ffff:/, "") ?? "127.0.0.1";
    return this.paymentService.createAttempt({
      userId: user.id,
      orderId: body.orderId,
      idempotencyKey,
      ipAddress,
    });
  }

  @Post("orders/:id/payments")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CUSTOMER")
  createOrderPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe({ version: "4" })) orderId: string,
    @Body() body: CreateOrderPaymentDto | undefined,
    @Headers("idempotency-key") headerKey: string | undefined,
    @Req() req: Request,
  ) {
    if (body && "amount" in (body as object)) {
      throw new BadRequestException({
        code: "CLIENT_AMOUNT_FORBIDDEN",
        message: "Client must not supply payment amount.",
      });
    }
    const idempotencyKey = headerKey ?? body?.idempotencyKey;
    const ipAddress = req.ip?.replace(/^::ffff:/, "") ?? "127.0.0.1";
    return this.paymentService.createAttempt({
      userId: user.id,
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CUSTOMER")
  @Header("Cache-Control", "no-store")
  getPaymentById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe({ version: "4" })) paymentId: string,
  ) {
    return this.paymentService.getPaymentById(user.id, paymentId);
  }

  @Get("orders/:id/payment-status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("CUSTOMER")
  @Header("Cache-Control", "no-store")
  getOrderPaymentStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe({ version: "4" })) orderId: string,
  ) {
    return this.paymentService.getOrderPaymentStatus(user.id, orderId);
  }
}
