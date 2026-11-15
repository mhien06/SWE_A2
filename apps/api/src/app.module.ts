import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { ProductModule } from "./product/product.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { CartModule } from "./cart/cart.module.js";
import { InventoryModule } from "./inventory/inventory.module.js";
import { LoyaltyModule } from "./loyalty/loyalty.module.js";
import { OrderModule } from "./order/order.module.js";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CartModule,
    InventoryModule,
    LoyaltyModule,
    OrderModule,
    ProductModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
