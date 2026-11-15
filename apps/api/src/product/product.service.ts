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

  async setAvailability(
    id: string,
    actorUserId: string,
    isAvailable: boolean,
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const product = await tx.product.findUnique({ where: { id } });
      if (!product) {
        throw new NotFoundException("Product not found");
      }
      if (product.isAvailable !== isAvailable) {
        await tx.product.update({
          where: { id },
          data: { isAvailable },
        });
        await tx.productAvailabilityChange.create({
          data: {
            productId: id,
            actorUserId,
            isAvailable,
            reason: reason.trim(),
          },
        });
      }
      return {
        id: product.id,
        name: product.name,
        isAvailable,
      };
    });
  }
}
