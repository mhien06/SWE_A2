import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ManageProductDto } from './dto/manage-product.dto.js';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async saveProduct(
    id: string | null,
    actorUserId: string,
    input: ManageProductDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (id)
        await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const before = id ? await tx.product.findUnique({ where: { id } }) : null;
      if (id && !before) throw new NotFoundException('Product not found');
      const data = {
        name: input.name.trim(),
        description: input.description.trim(),
        basePrice: input.basePrice,
      };
      const product = id
        ? await tx.product.update({ where: { id }, data })
        : await tx.product.create({
            data: {
              ...data,
              isAvailable: false,
              options: {
                create: { type: 'SIZE', name: 'S', additionalPrice: 0 },
              },
            },
          });
      await tx.productChange.create({
        data: {
          productId: product.id,
          actorUserId,
          reason: input.reason.trim(),
          ...(before
            ? {
                before: {
                  name: before.name,
                  description: before.description,
                  basePrice: Number(before.basePrice),
                },
              }
            : {}),
          after: data,
        },
      });
      return product;
    });
  }

  async history(productId: string) {
    const [changes, availability] = await Promise.all([
      this.prisma.productChange.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.productAvailabilityChange.findMany({
        where: { productId },
        orderBy: { changedAt: 'desc' },
        take: 100,
        include: { actor: { select: { name: true } } },
      }),
    ]);
    const actors = await this.prisma.user.findMany({
      where: { id: { in: changes.map((row) => row.actorUserId) } },
      select: { id: true, name: true },
    });
    return [
      ...changes.map((row) => ({
        id: row.id,
        at: row.createdAt,
        actor:
          actors.find((actor) => actor.id === row.actorUserId)?.name ??
          'Quản lý',
        reason: row.reason,
        before: row.before,
        after: row.after,
      })),
      ...availability.map((row) => ({
        id: row.id,
        at: row.changedAt,
        actor: row.actor.name,
        reason: row.reason,
        before: null,
        after: { isAvailable: row.isAvailable },
      })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 100);
  }

  async findAll() {
    const products = await this.prisma.product.findMany({
      orderBy: { name: 'asc' },
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
          orderBy: [{ type: 'asc' }, { additionalPrice: 'asc' }],
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
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
        throw new NotFoundException('Product not found');
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
