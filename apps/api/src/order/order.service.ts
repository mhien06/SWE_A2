import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { LoyaltyService } from "../loyalty/loyalty.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { OrderQuoteDto } from "./dto/order.dto.js";
import {
  PAYMENT_COMPENSATION_PORT,
  type PaymentCompensationPort,
} from "./payment-compensation.port.js";

const ORDER_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly loyalty: LoyaltyService,
    @Optional()
    @Inject(PAYMENT_COMPENSATION_PORT)
    private readonly paymentCompensation?: PaymentCompensationPort,
  ) {}

  async quote(userId: string, input: OrderQuoteDto) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: { include: { options: true } } } } },
    });
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException("Cart must contain at least one item");
    }

    const items = cart.items.map((item) => this.priceCartItem(item));
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const pointsRedeemed = input.pointsRedeemed ?? 0;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pointsBalance: true },
    });
    if (!user || (pointsRedeemed > 0 && pointsRedeemed > user.pointsBalance)) {
      throw new BadRequestException("Insufficient loyalty points");
    }
    const pointsDiscountAmount =
      this.loyalty.getRedemptionDiscount(pointsRedeemed);
    if (pointsDiscountAmount >= subtotal && pointsDiscountAmount > 0) {
      throw new BadRequestException(
        "Points discount must leave an amount payable through VNPay",
      );
    }

    return {
      items,
      subtotal,
      discountAmount: 0,
      totalAmount: subtotal,
      pointsRedeemed,
      pointsDiscountAmount,
      vnpayPayableAmount: subtotal - pointsDiscountAmount,
      expiresInSeconds: ORDER_TTL_MS / 1000,
    };
  }

  async createOrder(userId: string, input: OrderQuoteDto) {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: {
          items: {
            orderBy: { createdAt: "asc" },
            include: { product: { include: { options: true } } },
          },
        },
      });
      if (!cart || cart.items.length === 0) {
        throw new BadRequestException("Cart must contain at least one item");
      }

      const items = cart.items.map((item) => this.priceCartItem(item));
      const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
      const pointsRedeemed = input.pointsRedeemed ?? 0;
      const pointsDiscountAmount =
        this.loyalty.getRedemptionDiscount(pointsRedeemed);
      if (pointsDiscountAmount >= subtotal && pointsDiscountAmount > 0) {
        throw new BadRequestException(
          "Points discount must leave an amount payable through VNPay",
        );
      }

      const now = new Date();
      const order = await tx.order.create({
        data: {
          orderCode: `BL-${randomUUID()}`,
          userId,
          status: "PENDING",
          subtotal,
          discountAmount: 0,
          totalAmount: subtotal,
          pointsRedeemed,
          pointsDiscountAmount,
          vnpayPayableAmount: subtotal - pointsDiscountAmount,
          createdAt: now,
          expiresAt: new Date(now.getTime() + ORDER_TTL_MS),
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              productNameSnapshot: item.productName,
              selectedSizeSnapshot: item.selectedSize,
              selectedToppingsSnapshot: item.selectedToppings,
              unitPriceSnapshot: item.unitPrice,
              quantity: item.quantity,
              lineTotal: item.lineTotal,
            })),
          },
        },
        include: { items: true },
      });

      if (
        !(await this.inventory.checkIngredientsForOrder(tx, order.id))
      ) {
        throw new ConflictException(
          "Current recipes or ingredient stock cannot satisfy this order",
        );
      }

      if (pointsRedeemed > 0) {
        await this.loyalty.recordInTransaction(tx, {
          userId,
          orderId: order.id,
          paymentId: null,
          type: "REDEEM",
          points: -pointsRedeemed,
          valueVnd: pointsDiscountAmount,
          idempotencyKey: `redeem:${order.id}`,
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return order;
    });
  }

  async listCustomerOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });
  }

  async getCustomerOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: true,
        cancellation: true,
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, createdAt: true },
        },
      },
    });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    return order;
  }

  async listStaffOrders() {
    return this.prisma.order.findMany({
      where: {
        status: {
          in: ["PAYMENT_EXCEPTION", "PAID", "PREPARING", "READY_FOR_PICKUP"],
        },
      },
      orderBy: { createdAt: "asc" },
      include: {
        items: true,
        user: { select: { name: true, email: true } },
      },
    });
  }

  async updateStaffStatus(orderId: string, status: string) {
    const allowed: Record<string, string> = {
      PAID: "PREPARING",
      PREPARING: "READY_FOR_PICKUP",
      READY_FOR_PICKUP: "COMPLETED",
    };

    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        throw new NotFoundException("Order not found");
      }
      if (allowed[order.status] !== status) {
        throw new ConflictException(
          `Order cannot transition from ${order.status} to ${status}`,
        );
      }
      return tx.order.update({
        where: { id: orderId },
        data: { status: status as "PREPARING" | "READY_FOR_PICKUP" | "COMPLETED" },
        include: { items: true },
      });
    });
  }

  async cancelOrder(
    orderId: string,
    actor: { id: string; role: "CUSTOMER" | "STAFF" | "MANAGER" },
    reason?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          payments: { where: { status: "SUCCEEDED" }, orderBy: { createdAt: "desc" } },
          cancellation: true,
        },
      });
      if (!order || (actor.role === "CUSTOMER" && order.userId !== actor.id)) {
        throw new NotFoundException("Order not found");
      }
      if (order.status === "CANCELLED" && order.cancellation) {
        return {
          id: order.id,
          status: order.status,
          cancelledAt: order.cancellation.cancelledAt,
        };
      }

      const isStaff = actor.role === "STAFF" || actor.role === "MANAGER";
      if (
        isStaff &&
        (order.status !== "PAID" || !reason?.trim())
      ) {
        throw new BadRequestException(
          "Staff may cancel only a PAID order before preparation and must provide a reason",
        );
      }
      if (
        !isStaff &&
        !["PENDING", "PAYMENT_FAILED", "PAID"].includes(order.status)
      ) {
        throw new ConflictException("Order cannot be cancelled in its current state");
      }
      if (order.status === "PAID") {
        const payment = order.payments[0];
        if (!payment) {
          throw new ConflictException("Paid order has no verified payment");
        }
        if (!this.paymentCompensation) {
          throw new ServiceUnavailableException(
            "Payment compensation integration is not configured",
          );
        }

        const restoredUsages = await this.inventory.restoreIngredientsForOrder(
          tx,
          order.id,
        );
        if (restoredUsages === 0) {
          throw new ConflictException(
            "Paid order is missing ingredient usage records",
          );
        }
        await this.loyalty.returnRedeemedPoints(tx, {
          userId: order.userId,
          orderId: order.id,
          pointsRedeemed: order.pointsRedeemed,
          pointsDiscountAmount: order.pointsDiscountAmount,
        });
        await this.loyalty.reverseEarnedPoints(tx, {
          userId: order.userId,
          orderId: order.id,
        });
        await this.paymentCompensation.compensateVerifiedPayment(tx, {
          userId: order.userId,
          orderId: order.id,
          paymentId: payment.id,
          actualPaidVnd: payment.amount,
        });
      } else {
        await this.loyalty.returnRedeemedPoints(tx, {
          userId: order.userId,
          orderId: order.id,
          pointsRedeemed: order.pointsRedeemed,
          pointsDiscountAmount: order.pointsDiscountAmount,
        });
      }

      const cancelledAt = new Date();
      await tx.orderCancellation.create({
        data: {
          orderId: order.id,
          cancelledByUserId: actor.id,
          cancelledByRole: actor.role,
          reason: reason?.trim() || null,
          idempotencyKey: `cancel:${order.id}`,
          cancelledAt,
        },
      });
      const updated = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: "CANCELLED" },
      });
      if (updated.count !== 1) {
        throw new ConflictException("Order state changed while it was cancelled");
      }
      return { id: order.id, status: "CANCELLED", cancelledAt };
    });
  }

  private priceCartItem(item: {
    productId: string;
    selectedSize: string;
    selectedToppings: string[];
    quantity: number;
    product: {
      name: string;
      basePrice: { toString(): string };
      isAvailable: boolean;
      options: Array<{
        type: "SIZE" | "TOPPING";
        name: string;
        additionalPrice: { toString(): string };
        isAvailable: boolean;
      }>;
    };
  }) {
    if (!item.product.isAvailable) {
      throw new BadRequestException(`${item.product.name} is no longer available`);
    }
    const size = item.product.options.find(
      (option) =>
        option.type === "SIZE" &&
        option.name === item.selectedSize &&
        option.isAvailable,
    );
    if (!size) {
      throw new BadRequestException("The selected size is no longer available");
    }
    const toppings = item.selectedToppings.map((name) => {
      const topping = item.product.options.find(
        (option) =>
          option.type === "TOPPING" && option.name === name && option.isAvailable,
      );
      if (!topping) {
        throw new BadRequestException(`Topping ${name} is no longer available`);
      }
      return topping;
    });
    const unitPrice =
      money(item.product.basePrice) +
      money(size.additionalPrice) +
      toppings.reduce((total, option) => total + money(option.additionalPrice), 0);
    return {
      productId: item.productId,
      productName: item.product.name,
      selectedSize: size.name,
      selectedToppings: toppings.map((option) => option.name),
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
    };
  }

  private async lockOrder(tx: Prisma.TransactionClient, orderId: string) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Order" WHERE "id" = CAST(${orderId} AS uuid) FOR UPDATE`,
    );
  }
}

function money(value: { toString(): string }) {
  const amount = Number(value.toString());
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error("Product prices must be whole, non-negative VND amounts");
  }
  return amount;
}
