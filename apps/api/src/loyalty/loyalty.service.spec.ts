import { ConflictException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoyaltyService } from "./loyalty.service.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("LoyaltyService", () => {
  it("does not invent an earning rate when policy is unset", () => {
    vi.stubEnv("LOYALTY_EARN_POINTS_PER_VND", undefined);
    vi.stubEnv("LOYALTY_EARN_ROUNDING", undefined);
    const service = new LoyaltyService({} as never);

    expect(service.getEarnPoints(29050)).toBe(0);
  });

  it("does not allow redemption until a policy is configured", () => {
    vi.stubEnv("LOYALTY_REDEEM_VND_PER_POINT", undefined);
    const service = new LoyaltyService({} as never);

    expect(() => service.getRedemptionDiscount(1)).toThrow(ConflictException);
  });

  it("returns an existing ledger entry without applying balance effects twice", async () => {
    const existing = { id: "ledger-id", points: 15 };
    const tx = {
      loyaltyTransaction: {
        findUnique: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
      },
      user: { update: vi.fn() },
    };
    const service = new LoyaltyService({} as never);

    await expect(
      service.recordInTransaction(tx as never, {
        userId: "user-id",
        orderId: "order-id",
        paymentId: "payment-id",
        type: "EARN",
        points: 15,
        valueVnd: 15000,
        idempotencyKey: "earn:order-id",
      }),
    ).resolves.toEqual(existing);
    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
