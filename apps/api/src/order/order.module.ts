import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { InventoryModule } from "../inventory/inventory.module.js";
import { LoyaltyModule } from "../loyalty/loyalty.module.js";
import { OrderController, StaffOrderController } from "./order.controller.js";
import { OrderService } from "./order.service.js";

@Module({
  imports: [AuthModule, InventoryModule, LoyaltyModule],
  controllers: [OrderController, StaffOrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
