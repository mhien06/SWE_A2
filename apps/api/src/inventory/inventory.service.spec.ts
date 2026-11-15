import { describe, expect, it, vi } from "vitest";
import { InventoryService } from "./inventory.service.js";

describe("InventoryService", () => {
  it("audits initial stock when creating an ingredient", async () => {
    const tx = {
      ingredient: {
        create: vi.fn().mockResolvedValue({
          id: "11111111-1111-4111-8111-111111111111",
        }),
      },
      inventoryAdjustment: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn((work) => work(tx)),
    };
    const service = new InventoryService(prisma as never);

    await service.createIngredient("manager-id", {
      name: "Hạt cà phê",
      unit: "GRAM",
      quantityOnHand: 500,
      reason: "Nhập kho ban đầu",
    });

    expect(tx.inventoryAdjustment.create).toHaveBeenCalledWith({
      data: {
        ingredientId: "11111111-1111-4111-8111-111111111111",
        actorUserId: "manager-id",
        quantityDelta: 500,
        reason: "Nhập kho ban đầu",
      },
    });
  });

  it("does not deduct ingredients again when usage already exists", async () => {
    const tx = {
      orderIngredientUsage: {
        findMany: vi.fn().mockResolvedValue([
          {
            ingredientId: "11111111-1111-4111-8111-111111111111",
            ingredientNameSnapshot: "Hạt cà phê",
            quantityDeducted: { toString: () => "18" },
            unitSnapshot: "GRAM",
          },
        ]),
      },
      orderItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "order-item-id",
            selectedSizeSnapshot: "S",
            selectedToppingsSnapshot: [],
            quantity: 1,
            product: {
              options: [{ id: "size-id", type: "SIZE", name: "S" }],
              recipes: [
                {
                  productOptionId: null,
                  ingredients: [
                    {
                      ingredientId: "11111111-1111-4111-8111-111111111111",
                      unit: "GRAM",
                      quantity: { toString: () => "18" },
                      ingredient: { name: "Hạt cà phê" },
                    },
                  ],
                },
              ],
            },
          },
        ]),
      },
      ingredient: { update: vi.fn() },
    };
    const service = new InventoryService({} as never);

    await expect(
      service.deductIngredientsForOrder(tx as never, "order-id"),
    ).resolves.toEqual({
      sufficient: true,
      deductedItems: [
        {
          ingredientId: "11111111-1111-4111-8111-111111111111",
          ingredientNameSnapshot: "Hạt cà phê",
          quantityDeducted: 18,
          unitSnapshot: "GRAM",
        },
      ],
    });
    expect(tx.ingredient.update).not.toHaveBeenCalled();
  });
});
