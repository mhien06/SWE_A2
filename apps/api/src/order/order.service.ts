import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { OrderQuoteDto } from './dto/order.dto.js';
import {
  PAYMENT_COMPENSATION_PORT,
  type PaymentCompensationPort,
} from './payment-compensation.port.js';

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
      include: {
        items: { include: { product: { include: { options: true } } } },
      },
    });
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart must contain at least one item');
    }

    const items = cart.items.map((item) => this.priceCartItem(item));
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const pointsRedeemed = input.pointsRedeemed ?? 0;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pointsBalance: true },
    });
    if (!user || (pointsRedeemed > 0 && pointsRedeemed > user.pointsBalance)) {
      throw new BadRequestException('Insufficient loyalty points');
    }
    const pointsDiscountAmount =
      this.loyalty.getRedemptionDiscount(pointsRedeemed);
    if (pointsDiscountAmount > subtotal && pointsDiscountAmount > 0) {
      throw new BadRequestException(
        'Giá trị điểm sử dụng không được vượt quá tổng đơn',
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
            orderBy: { createdAt: 'asc' },
            include: { product: { include: { options: true } } },
          },
        },
      });
      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Cart must contain at least one item');
      }

      const items = cart.items.map((item) => this.priceCartItem(item));
      const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
      const pointsRedeemed = input.pointsRedeemed ?? 0;
      const pointsDiscountAmount =
        this.loyalty.getRedemptionDiscount(pointsRedeemed);
      if (pointsDiscountAmount > subtotal && pointsDiscountAmount > 0) {
        throw new BadRequestException(
          'Giá trị điểm sử dụng không được vượt quá tổng đơn',
        );
      }

      if ((input.expectedSubtotal !== undefined && input.expectedSubtotal !== subtotal) || (input.expectedPointsDiscount !== undefined && input.expectedPointsDiscount !== pointsDiscountAmount)) {
        throw new ConflictException('Giá hoặc chính sách điểm đã thay đổi. Vui lòng xem giá chính thức và xác nhận lại.');
      }
      const now = new Date();
      const order = await tx.order.create({
        data: {
          orderCode: `BL-${randomUUID()}`,
          userId,
          status: 'PENDING',
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

      if (!(await this.inventory.checkIngredientsForOrder(tx, order.id))) {
        throw new ConflictException(
          'Current recipes or ingredient stock cannot satisfy this order',
        );
      }

      if (pointsRedeemed > 0) {
        await this.loyalty.recordInTransaction(tx, {
          userId,
          orderId: order.id,
          paymentId: null,
          type: 'REDEEM',
          points: -pointsRedeemed,
          valueVnd: pointsDiscountAmount,
          idempotencyKey: `redeem:${order.id}`,
        });
      }

      if (pointsRedeemed > 0 && pointsDiscountAmount === subtotal) {
        const deduction = await this.inventory.deductIngredientsForOrder(tx, order.id);
        if (!deduction.sufficient) throw new ConflictException('Không đủ nguyên liệu; chưa trừ điểm hoặc tạo đơn.');
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        return tx.order.update({ where: { id: order.id }, data: { status: 'PAID' }, include: { items: true } });
      }
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return order;
    });
  }

  async listCustomerOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
  }

  async audit(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderCode: true,
        status: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        cancellation: { include: { cancelledBy: { select: { name: true } } } },
        payments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            amount: true,
            transactionRef: true,
            createdAt: true,
            verifiedAt: true,
            reviewRequired: true,
            settlementSource: true,
            refundRecords: {
              select: {
                id: true,
                status: true,
                amount: true,
                requestedAt: true,
                resolvedAt: true,
              },
            },
          },
        },
        paymentEvents: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            paymentId: true,
            eventType: true,
            source: true,
            createdAt: true,
          },
        },
        loyaltyTransactions: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            points: true,
            createdAt: true,
            paymentId: true,
          },
        },
        items: {
          select: { productNameSnapshot: true, ingredientUsages: true },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    const statusChanges = await this.prisma.orderStatusChange.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
    const actors = await this.prisma.user.findMany({
      where: { id: { in: statusChanges.map((row) => row.actorUserId) } },
      select: { id: true, name: true },
    });
    return {
      ...order,
      statusChanges: statusChanges.map((row) => ({
        ...row,
        actor:
          actors.find((actor) => actor.id === row.actorUserId)?.name ??
          'Nhân viên',
      })),
    };
  }

  async getCustomerOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: true,
        cancellation: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            createdAt: true,
            amount: true,
            verifiedAt: true,
          },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async listStaffOrders(all = false, review = false) {
    return this.prisma.order.findMany({
      where: review ? { payments: { some: { reviewRequired: true } } } : all
        ? {}
        : {
            status: {
              in: [
                'PAYMENT_EXCEPTION',
                'PAID',
                'PREPARING',
                'READY_FOR_PICKUP',
              ],
            },
          },
      take: 200,
      orderBy: { createdAt: all ? 'desc' : 'asc' },
      include: {
        items: true,
        user: { select: { name: true, email: true } },
      },
    });
  }

  async retryReconciliation(orderId: string, actorUserId: string) {
    return this.prisma.$transaction(async tx => {
      await this.lockOrder(tx, orderId);
      const payments = await tx.payment.findMany({where:{orderId,reviewRequired:true,status:{in:['PENDING','UNKNOWN']}}});
      for (const payment of payments) {
        await tx.payment.update({where:{id:payment.id},data:{reviewRequired:false,queryAttempts:0,nextQueryAt:new Date()}});
        await tx.paymentEvent.create({data:{orderId,paymentId:payment.id,eventType:'MANUAL_RECONCILIATION_REQUESTED',source:'STAFF',details:{actorUserId}}});
      }
      return { scheduled: payments.length, message: payments.length ? 'Đã yêu cầu đối soát lại. Kết quả vẫn phải được VNPay xác minh.' : 'Không có giao dịch chưa rõ cần đối soát lại.' };
    });
  }

  async updateStaffStatus(
    orderId: string,
    status: string,
    actorUserId: string,
  ) {
    const allowed: Record<string, string> = {
      PAID: 'PREPARING',
      PREPARING: 'READY_FOR_PICKUP',
      READY_FOR_PICKUP: 'COMPLETED',
    };

    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (allowed[order.status] !== status) {
        throw new ConflictException(
          `Order cannot transition from ${order.status} to ${status}`,
        );
      }
      await tx.orderStatusChange.create({
        data: {
          orderId,
          actorUserId,
          fromStatus: order.status,
          toStatus: status as 'PREPARING' | 'READY_FOR_PICKUP' | 'COMPLETED',
        },
      });
      return tx.order.update({
        where: { id: orderId },
        data: {
          status: status as 'PREPARING' | 'READY_FOR_PICKUP' | 'COMPLETED',
        },
        include: { items: true },
      });
    });
  }

  async cancelOrder(
    orderId: string,
    actor: { id: string; role: 'CUSTOMER' | 'STAFF' | 'MANAGER' },
    reason?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOrder(tx, orderId);
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          payments: {
            where: { status: { in: ['SUCCEEDED', 'PENDING', 'UNKNOWN'] } },
            orderBy: { createdAt: 'desc' },
          },
          cancellation: true,
        },
      });
      if (!order || (actor.role === 'CUSTOMER' && order.userId !== actor.id)) {
        throw new NotFoundException('Order not found');
      }
      if (order.status === 'CANCELLED' && order.cancellation) {
        return {
          id: order.id,
          status: order.status,
          cancelledAt: order.cancellation.cancelledAt,
        };
      }

      const isStaff = actor.role === 'STAFF' || actor.role === 'MANAGER';
      if (isStaff && (order.status !== 'PAID' || !reason?.trim())) {
        throw new BadRequestException(
          'Staff may cancel only a PAID order before preparation and must provide a reason',
        );
      }
      if (
        !isStaff &&
        !['PENDING', 'PAYMENT_FAILED', 'PAID'].includes(order.status)
      ) {
        throw new ConflictException(
          'Order cannot be cancelled in its current state',
        );
      }
      const unresolved = order.payments.find(payment => payment.status === 'PENDING' || payment.status === 'UNKNOWN');
      if (unresolved) {
        const existing = await tx.paymentEvent.findFirst({ where: { orderId, paymentId: unresolved.id, eventType: 'CANCEL_AWAITING_RECONCILIATION' } });
        if (!existing) await tx.paymentEvent.create({ data: { orderId, paymentId: unresolved.id, eventType: 'CANCEL_AWAITING_RECONCILIATION', source: 'CANCEL', details: { actorId: actor.id, reason: reason?.trim() ?? null } } });
        await tx.payment.update({ where: { id: unresolved.id }, data: { nextQueryAt: new Date() } });
        return { id: order.id, status: order.status, pendingCancellation: true, message: 'Giao dịch đang được đối soát. Đơn chưa hủy và chưa hoàn điểm; vui lòng thử hủy lại khi kết quả đã rõ.' };
      }
      if (order.status === 'PAID') {
        const pointsOnly = order.vnpayPayableAmount === 0 && order.pointsRedeemed > 0;
        const payment = order.payments[0];
        if (!payment && !pointsOnly) {
          throw new ConflictException('Paid order has no verified payment');
        }
        if (!pointsOnly && !this.paymentCompensation) {
          throw new ServiceUnavailableException(
            'Payment compensation integration is not configured',
          );
        }

        const restoredUsages = await this.inventory.restoreIngredientsForOrder(
          tx,
          order.id,
        );
        if (restoredUsages === 0) {
          throw new ConflictException(
            'Paid order is missing ingredient usage records',
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
        if (!pointsOnly && payment) await this.paymentCompensation!.compensateVerifiedPayment(tx, {
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
        data: { status: 'CANCELLED' },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          'Order state changed while it was cancelled',
        );
      }
      return { id: order.id, status: 'CANCELLED', cancelledAt };
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
        type: 'SIZE' | 'TOPPING';
        name: string;
        additionalPrice: { toString(): string };
        isAvailable: boolean;
      }>;
    };
  }) {
    if (!item.product.isAvailable) {
      throw new BadRequestException(
        `${item.product.name} is no longer available`,
      );
    }
    const size = item.product.options.find(
      (option) =>
        option.type === 'SIZE' &&
        option.name === item.selectedSize &&
        option.isAvailable,
    );
    if (!size) {
      throw new BadRequestException('The selected size is no longer available');
    }
    const toppings = item.selectedToppings.map((name) => {
      const topping = item.product.options.find(
        (option) =>
          option.type === 'TOPPING' &&
          option.name === name &&
          option.isAvailable,
      );
      if (!topping) {
        throw new BadRequestException(`Topping ${name} is no longer available`);
      }
      return topping;
    });
    const unitPrice =
      money(item.product.basePrice) +
      money(size.additionalPrice) +
      toppings.reduce(
        (total, option) => total + money(option.additionalPrice),
        0,
      );
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
    throw new Error('Product prices must be whole, non-negative VND amounts');
  }
  return amount;
}
