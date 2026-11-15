import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { Prisma, type LoyaltyTransactionType } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        pointsBalance: true,
        loyalty: {
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            type: true,
            points: true,
            valueVnd: true,
            orderId: true,
            paymentId: true,
            createdAt: true,
          },
        },
      },
    });
    if (!user) {
      throw new ConflictException("User account is unavailable");
    }
    return {
      pointsBalance: user.pointsBalance,
      transactions: user.loyalty,
      redemptionVndPerPoint: Number(process.env.LOYALTY_REDEEM_VND_PER_POINT) > 0 ? this.getRedemptionDiscount(1) : null,
    };
  }

  getEarnPoints(amountVnd: number): number {
    const rate = process.env.LOYALTY_EARN_POINTS_PER_VND?.trim();
    const rounding = process.env.LOYALTY_EARN_ROUNDING?.trim();
    if (!rate && !rounding) {
      return 0;
    }
    if (!rate || !rounding) {
      throw new Error(
        "LOYALTY_EARN_POINTS_PER_VND and LOYALTY_EARN_ROUNDING must be configured together",
      );
    }

    const pointsPerVnd = Number(rate);
    if (!Number.isFinite(pointsPerVnd) || pointsPerVnd < 0) {
      throw new Error("LOYALTY_EARN_POINTS_PER_VND must be a non-negative number");
    }
    if (rounding !== "FLOOR" && rounding !== "CEIL" && rounding !== "ROUND") {
      throw new Error("LOYALTY_EARN_ROUNDING must be FLOOR, CEIL, or ROUND");
    }

    const exact = amountVnd * pointsPerVnd;
    const points =
      rounding === "CEIL"
        ? Math.ceil(exact)
        : rounding === "ROUND"
          ? Math.round(exact)
          : Math.floor(exact);
    if (!Number.isSafeInteger(points)) {
      throw new Error("Configured EARN policy produced an unsafe point amount");
    }
    return points;
  }

  getRedemptionDiscount(points: number): number {
    if (points === 0) {
      return 0;
    }
    const valuePerPoint = process.env.LOYALTY_REDEEM_VND_PER_POINT?.trim();
    if (!valuePerPoint) {
      throw new ConflictException(
        "Point redemption is unavailable until a redemption policy is configured",
      );
    }

    const vndPerPoint = Number(valuePerPoint);
    if (!Number.isSafeInteger(vndPerPoint) || vndPerPoint <= 0) {
      throw new Error("LOYALTY_REDEEM_VND_PER_POINT must be a positive integer");
    }
    const discount = points * vndPerPoint;
    if (!Number.isSafeInteger(discount)) {
      throw new BadRequestException("Point redemption amount is too large");
    }
    return discount;
  }

  async recordInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      orderId: string | null;
      paymentId: string | null;
      type: LoyaltyTransactionType;
      points: number;
      valueVnd: number | null;
      idempotencyKey: string;
    },
  ) {
    if (!Number.isSafeInteger(input.points) || input.points === 0) {
      throw new BadRequestException("Loyalty transaction points must be a non-zero integer");
    }
    if (
      (input.type === "EARN" ||
        input.type === "RETURN_REDEEMED" ||
        input.type === "VNPAY_COMPENSATION") &&
      input.points < 0
    ) {
      throw new BadRequestException(`${input.type} must add points`);
    }
    if (
      (input.type === "REDEEM" || input.type === "REVERSE_EARNED") &&
      input.points > 0
    ) {
      throw new BadRequestException(`${input.type} must subtract points`);
    }

    const existing = await tx.loyaltyTransaction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return existing;
    }

    if (input.paymentId && input.type === "VNPAY_COMPENSATION") {
      const compensation = await tx.loyaltyTransaction.findUnique({
        where: {
          paymentId_type: {
            paymentId: input.paymentId,
            type: input.type,
          },
        },
      });
      if (compensation) {
        return compensation;
      }
    }

    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "User" WHERE "id" = CAST(${input.userId} AS uuid) FOR UPDATE`,
    );
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { pointsBalance: true },
    });
    if (!user) {
      throw new ConflictException("User account is unavailable");
    }
    if (input.type === "REDEEM" && user.pointsBalance + input.points < 0) {
      throw new BadRequestException("Insufficient loyalty points");
    }

    const transaction = await tx.loyaltyTransaction.create({ data: input });
    await tx.user.update({
      where: { id: input.userId },
      data: { pointsBalance: { increment: input.points } },
    });
    return transaction;
  }

  async returnRedeemedPoints(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      orderId: string;
      pointsRedeemed: number;
      pointsDiscountAmount: number;
    },
  ) {
    if (input.pointsRedeemed <= 0) {
      return null;
    }
    return this.recordInTransaction(tx, {
      userId: input.userId,
      orderId: input.orderId,
      paymentId: null,
      type: "RETURN_REDEEMED",
      points: input.pointsRedeemed,
      valueVnd: input.pointsDiscountAmount,
      idempotencyKey: `return-redeem:${input.orderId}`,
    });
  }

  async reverseEarnedPoints(
    tx: Prisma.TransactionClient,
    input: { userId: string; orderId: string },
  ) {
    const earned = await tx.loyaltyTransaction.aggregate({
      where: { userId: input.userId, orderId: input.orderId, type: "EARN" },
      _sum: { points: true },
    });
    const points = earned._sum.points ?? 0;
    if (points <= 0) {
      return null;
    }
    return this.recordInTransaction(tx, {
      userId: input.userId,
      orderId: input.orderId,
      paymentId: null,
      type: "REVERSE_EARNED",
      points: -points,
      valueVnd: null,
      idempotencyKey: `reverse-earn:${input.orderId}`,
    });
  }
}
