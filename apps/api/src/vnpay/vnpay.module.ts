import { Module } from "@nestjs/common";
import { VnpayGateway } from "./vnpay.gateway.js";
import { PAYMENT_GATEWAY } from "./vnpay.types.js";

@Module({
  providers: [
    VnpayGateway,
    {
      provide: PAYMENT_GATEWAY,
      useExisting: VnpayGateway,
    },
  ],
  exports: [VnpayGateway, PAYMENT_GATEWAY],
})
export class VnpayModule {}
