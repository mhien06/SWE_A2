import { describe, expect, it, vi } from "vitest";
import { PrismaService } from "../prisma/prisma.service.js";
import { CartService } from "./cart.service.js";

describe("CartService", () => {
  it("uses database prices instead of any client-provided price", async () => {
    const options = [
      {
        id: "22222222-2222-4222-8222-222222222222",
        type: "SIZE",
        name: "M",
        additionalPrice: { toString: () => "5000" },
        isAvailable: true,
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        type: "TOPPING",
        name: "Trân châu",
        additionalPrice: { toString: () => "8000" },
        isAvailable: true,
      },
    ];
    const cart = {
      id: "44444444-4444-4444-8444-444444444444",
      findUnique: vi
        .fn()
        .mockResolvedValueOnce({ id: "cart-id" })
        .mockResolvedValueOnce({
          id: "cart-id",
          items: [
            {
              id: "55555555-5555-4555-8555-555555555555",
              productId: "11111111-1111-4111-8111-111111111111",
              selectedSize: "M",
              selectedToppings: ["Trân châu"],
              quantity: 2,
              product: {
                name: "Cà phê sữa",
                basePrice: { toString: () => "29000" },
                isAvailable: true,
                options,
              },
            },
          ],
        }),
    };
    const prisma = {
      cart,
      product: {
        findUnique: vi.fn().mockResolvedValue({
          name: "Cà phê sữa",
          basePrice: { toString: () => "29000" },
          isAvailable: true,
          options,
        }),
      },
      cartItem: { create: vi.fn().mockResolvedValue({}) },
    };
    const service = new CartService(prisma as unknown as PrismaService);

    await service.addItem("user-id", {
      productId: "11111111-1111-4111-8111-111111111111",
      sizeOptionId: "22222222-2222-4222-8222-222222222222",
      toppingOptionIds: ["33333333-3333-4333-8333-333333333333"],
      quantity: 2,
    });

    expect(prisma.cartItem.create).toHaveBeenCalledWith({
      data: {
        cartId: "cart-id",
        productId: "11111111-1111-4111-8111-111111111111",
        selectedSize: "M",
        selectedToppings: ["Trân châu"],
        quantity: 2,
        estimatedUnitPrice: 42000,
      },
    });
  });
});
