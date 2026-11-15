import { Module } from "@nestjs/common";
import { ProductController } from "./product.controller.js";
import { ProductAdminController } from "./product-admin.controller.js";
import { ProductService } from "./product.service.js";
import { AuthModule } from "../auth/auth.module.js";

@Module({
  imports: [AuthModule],
  controllers: [ProductController, ProductAdminController],
  providers: [ProductService],
})
export class ProductModule {}
