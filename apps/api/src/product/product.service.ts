import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const products = await this.prisma.product.findMany({
      orderBy: { name: "asc" },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      basePrice: Number(product.basePrice),
      isAvailable: product.isAvailable,
    }));
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        options: {
          orderBy: [{ type: "asc" }, { additionalPrice: "asc" }],
        },
      },
    });

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      basePrice: Number(product.basePrice),
      isAvailable: product.isAvailable,
      options: product.options.map((option) => ({
        id: option.id,
        type: option.type,
        name: option.name,
        additionalPrice: Number(option.additionalPrice),
        isAvailable: option.isAvailable,
      })),
    };
  }
}
