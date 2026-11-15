import { describe, expect, it, vi } from "vitest";
import { ProductService } from "./product.service.js";

describe("ProductService availability audit", () => {
  it("records the manager, reason, and new availability in the same transaction", async () => {
    const tx = {
      $queryRaw: vi.fn(),
      product: {
        findUnique: vi.fn().mockResolvedValue({
          id: "11111111-1111-4111-8111-111111111111",
          name: "Cà phê sữa",
          isAvailable: true,
        }),
        update: vi.fn(),
      },
      productAvailabilityChange: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn((work) => work(tx)),
    };
    const service = new ProductService(prisma as never);

    await expect(
      service.setAvailability(
        "11111111-1111-4111-8111-111111111111",
        "manager-id",
        false,
        " Tạm hết nguyên liệu ",
      ),
    ).resolves.toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Cà phê sữa",
      isAvailable: false,
    });
    expect(tx.productAvailabilityChange.create).toHaveBeenCalledWith({
      data: {
        productId: "11111111-1111-4111-8111-111111111111",
        actorUserId: "manager-id",
        isAvailable: false,
        reason: "Tạm hết nguyên liệu",
      },
    });
  });
});
