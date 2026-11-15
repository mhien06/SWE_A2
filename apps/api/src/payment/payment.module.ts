import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { InventoryModule } from "../inventory/inventory.module.js";
import { LoyaltyModule } from "../loyalty/loyalty.module.js";
import { PAYMENT_COMPENSATION_PORT } from "../order/payment-compensation.port.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { VnpayModule } from "../vnpay/vnpay.module.js";
import {
  PaymentCompensationService,
  PrismaPaymentCompensationAdapter,
} from "./payment-compensation.service.js";
import { PaymentSettlementService } from "./payment-settlement.service.js";
import { PAYMENT_REPOSITORY_PORT } from "./payment.contracts.js";
import { PaymentController } from "./payment.controller.js";
import { PaymentService } from "./payment.service.js";
import { PrismaPaymentRepository } from "./prisma-payment.store.js";

@Module({
  imports: [PrismaModule, AuthModule, InventoryModule, LoyaltyModule, VnpayModule],
  controllers: [PaymentController],
  providers: [
    PrismaPaymentRepository,
    {
      provide: PAYMENT_REPOSITORY_PORT,
      useExisting: PrismaPaymentRepository,
    },
    PaymentCompensationService,
    PrismaPaymentCompensationAdapter,
    {
      provide: PAYMENT_COMPENSATION_PORT,
      useExisting: PrismaPaymentCompensationAdapter,
    },
    PaymentSettlementService,
    PaymentService,
  ],
  exports: [
    PAYMENT_REPOSITORY_PORT,
    PAYMENT_COMPENSATION_PORT,
    PrismaPaymentRepository,
    PaymentCompensationService,
    PaymentSettlementService,
    PaymentService,
  ],
})
export class PaymentModule {}
