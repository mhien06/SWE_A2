import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { ProductService } from "./product.service.js";

@Controller("products")
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  findAll() {
    return this.productService.findAll();
  }

  @Get(":id")
  findOne(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.productService.findOne(id);
  }
}
