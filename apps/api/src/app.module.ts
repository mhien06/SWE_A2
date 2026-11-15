import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { ProductModule } from "./product/product.module.js";

@Module({
  imports: [PrismaModule, ProductModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
