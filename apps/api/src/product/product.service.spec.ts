import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PrismaService } from "../prisma/prisma.service.js";
import { ProductService } from "./product.service.js";

function decimal(value: number) {
  return { toString: () => String(value), valueOf: () => value };
}

describe("ProductService", () => {
  it("returns the menu with numeric prices and availability", async () => {
    const product = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Cà phê sữa",
          description: "Cà phê và sữa đặc",
          basePrice: decimal(29000),
          isAvailable: true,
        },
      ]),
    };
    const service = new ProductService({ product } as unknown as PrismaService);

    await expect(service.findAll()).resolves.toEqual([
      expect.objectContaining({ basePrice: 29000, isAvailable: true }),
    ]);
  });

  it("returns product detail with size and topping options", async () => {
    const product = {
      findUnique: vi.fn().mockResolvedValue({
        id: "11111111-1111-4111-8111-111111111111",
        name: "Cà phê sữa",
        description: "Cà phê và sữa đặc",
        basePrice: decimal(29000),
        isAvailable: true,
        options: [
          {
            id: "option-1",
            type: "SIZE",
            name: "M",
            additionalPrice: decimal(5000),
            isAvailable: true,
          },
        ],
      }),
    };
    const service = new ProductService({ product } as unknown as PrismaService);

    await expect(
      service.findOne("11111111-1111-4111-8111-111111111111"),
    ).resolves.toEqual(
      expect.objectContaining({
        basePrice: 29000,
        options: [expect.objectContaining({ additionalPrice: 5000 })],
      }),
    );
  });

  it("throws 404 when the product does not exist", async () => {
    const product = { findUnique: vi.fn().mockResolvedValue(null) };
    const service = new ProductService({ product } as unknown as PrismaService);

    await expect(
      service.findOne("99999999-9999-4999-8999-999999999999"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
