import { Module } from "@nestjs/common";
import { VnpayModule } from "../vnpay/vnpay.module.js";
import { PaymentCompensationService } from "./payment-compensation.service.js";
import { PaymentSettlementService } from "./payment-settlement.service.js";
import { PAYMENT_REPOSITORY_PORT } from "./payment.contracts.js";
import { PaymentController } from "./payment.controller.js";
import { PaymentService } from "./payment.service.js";
import { InMemoryPaymentRepository } from "./prisma-payment.store.js";

@Module({
  imports: [VnpayModule],
  controllers: [PaymentController],
  providers: [
    InMemoryPaymentRepository,
    {
      provide: PAYMENT_REPOSITORY_PORT,
      useExisting: InMemoryPaymentRepository,
    },
    PaymentCompensationService,
    PaymentSettlementService,
    PaymentService,
  ],
  exports: [
    PAYMENT_REPOSITORY_PORT,
    InMemoryPaymentRepository,
    PaymentCompensationService,
    PaymentSettlementService,
    PaymentService,
  ],
})
export class PaymentModule {}
