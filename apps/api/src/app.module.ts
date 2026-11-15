import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { PaymentModule } from "./payment/payment.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { ProductModule } from "./product/product.module.js";
import { SchedulerModule } from "./scheduler/scheduler.module.js";

@Module({
  imports: [PrismaModule, ProductModule, PaymentModule, SchedulerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
