import { Module } from "@nestjs/common";
import { PaymentModule } from "../payment/payment.module.js";
import { VnpayModule } from "../vnpay/vnpay.module.js";
import { PaymentReconciliationService } from "./payment-reconciliation.service.js";

@Module({
  imports: [VnpayModule, PaymentModule],
  providers: [PaymentReconciliationService],
  exports: [PaymentReconciliationService],
})
export class SchedulerModule {}
