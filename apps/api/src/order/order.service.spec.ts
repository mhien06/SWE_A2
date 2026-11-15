import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { InventoryService } from "../inventory/inventory.service.js";
import { LoyaltyService } from "../loyalty/loyalty.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { OrderService } from "./order.service.js";

const productId = "11111111-1111-4111-8111-111111111111";

function cartItem() {
  return {
    productId,
    selectedSize: "M",
    selectedToppings: ["Trân châu"],
    quantity: 2,
    product: {
      name: "Cà phê sữa",
      basePrice: { toString: () => "29000" },
      isAvailable: true,
      options: [
        {
          type: "SIZE",
          name: "M",
          additionalPrice: { toString: () => "5000" },
          isAvailable: true,
        },
        {
          type: "TOPPING",
          name: "Trân châu",
          additionalPrice: { toString: () => "8000" },
          isAvailable: true,
        },
      ],
    },
  };
}

describe("OrderService", () => {
  it.each(["CUSTOMER", "STAFF", "MANAGER"] as const)("%s cancels a paid order and applies inventory/point effects only once", async (role) => {
    const order = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", userId: "customer-id", status: "PAID", pointsRedeemed: 20, pointsDiscountAmount: 2000, payments: [{ id: "payment-id", amount: 29050 }], cancellation: null as null | { cancelledAt: Date } };
    const tx = {
      $queryRaw: vi.fn(),
      order: { findUnique: vi.fn(async () => order), updateMany: vi.fn(async () => { order.status = "CANCELLED"; return { count: 1 }; }) },
      orderCancellation: { create: vi.fn(async () => { order.cancellation = { cancelledAt: new Date() }; }) },
    };
    const inventory = { restoreIngredientsForOrder: vi.fn().mockResolvedValue(1) };
    const loyalty = { returnRedeemedPoints: vi.fn(), reverseEarnedPoints: vi.fn() };
    const compensation = { compensateVerifiedPayment: vi.fn().mockResolvedValue({ outcome: "GRANTED", pointsGranted: 291, idempotencyKey: "vnpay-comp:payment-id" }) };
    const service = new OrderService({ $transaction: vi.fn(work => work(tx)) } as unknown as PrismaService, inventory as unknown as InventoryService, loyalty as unknown as LoyaltyService, compensation);
    await service.cancelOrder(order.id, { id: role === "CUSTOMER" ? "customer-id" : "operator-id", role }, "Khách yêu cầu hủy");
    await service.cancelOrder(order.id, { id: role === "CUSTOMER" ? "customer-id" : "operator-id", role }, "Khách yêu cầu hủy");
    expect(loyalty.returnRedeemedPoints).toHaveBeenCalledExactlyOnceWith(tx, { userId: "customer-id", orderId: order.id, pointsRedeemed: 20, pointsDiscountAmount: 2000 });
    expect(loyalty.reverseEarnedPoints).toHaveBeenCalledTimes(1);
    expect(compensation.compensateVerifiedPayment).toHaveBeenCalledExactlyOnceWith(tx, { userId: "customer-id", orderId: order.id, paymentId: "payment-id", actualPaidVnd: 29050 });
    expect(inventory.restoreIngredientsForOrder).toHaveBeenCalledTimes(1);
  });
  it("creates a 15-minute PENDING snapshot without deducting inventory", async () => {
    const createdOrder = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      orderCode: "BL-test",
      status: "PENDING",
      items: [],
    };
    const tx = {
      cart: {
        findUnique: vi.fn().mockResolvedValue({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          items: [cartItem()],
        }),
      },
      order: { create: vi.fn().mockResolvedValue(createdOrder) },
      cartItem: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      $transaction: vi.fn((work) => work(tx)),
    };
    const inventory = {
      checkIngredientsForOrder: vi.fn().mockResolvedValue(true),
      deductIngredientsForOrder: vi.fn(),
    };
    const loyalty = {
      getRedemptionDiscount: vi.fn().mockReturnValue(0),
      recordInTransaction: vi.fn(),
    };
    const service = new OrderService(
      prisma as unknown as PrismaService,
      inventory as unknown as InventoryService,
      loyalty as unknown as LoyaltyService,
    );
    const before = Date.now();

    await service.createOrder("user-id", { pointsRedeemed: 0 });

    const data = tx.order.create.mock.calls[0]?.[0].data;
    expect(data.status).toBe("PENDING");
    expect(data.subtotal).toBe(84000);
    expect(data.items.create[0]).toMatchObject({
      productNameSnapshot: "Cà phê sữa",
      selectedSizeSnapshot: "M",
      selectedToppingsSnapshot: ["Trân châu"],
      unitPriceSnapshot: 42000,
      quantity: 2,
      lineTotal: 84000,
    });
    expect(data.expiresAt.getTime() - data.createdAt.getTime()).toBe(15 * 60 * 1000);
    expect(data.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(inventory.checkIngredientsForOrder).toHaveBeenCalledWith(
      tx,
      createdOrder.id,
    );
    expect(inventory.deductIngredientsForOrder).not.toHaveBeenCalled();
    expect(tx.cartItem.deleteMany).toHaveBeenCalled();
  });

  it("rolls back order creation when current recipes or stock are insufficient", async () => {
    const tx = {
      cart: {
        findUnique: vi.fn().mockResolvedValue({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          items: [cartItem()],
        }),
      },
      order: {
        create: vi.fn().mockResolvedValue({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          items: [],
        }),
      },
      cartItem: { deleteMany: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (work) => work(tx)),
    };
    const inventory = { checkIngredientsForOrder: vi.fn().mockResolvedValue(false) };
    const loyalty = { getRedemptionDiscount: vi.fn().mockReturnValue(0) };
    const service = new OrderService(
      prisma as unknown as PrismaService,
      inventory as unknown as InventoryService,
      loyalty as unknown as LoyaltyService,
    );

    await expect(
      service.createOrder("user-id", { pointsRedeemed: 0 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
  });

  it("does not reveal an order owned by another customer", async () => {
    const prisma = {
      order: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new OrderService(
      prisma as unknown as PrismaService,
      {} as InventoryService,
      {} as LoyaltyService,
    );

    await expect(
      service.getCustomerOrder(
        "customer-id",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ),
    ).rejects.toThrow("Order not found");
  });

  it("rejects cancellation after staff has started preparing the order", async () => {
    const tx = {
      $queryRaw: vi.fn(),
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          userId: "customer-id",
          status: "PREPARING",
          payments: [],
          cancellation: null,
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn((work) => work(tx)),
    };
    const service = new OrderService(
      prisma as unknown as PrismaService,
      {} as InventoryService,
      {} as LoyaltyService,
    );

    await expect(
      service.cancelOrder(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        { id: "staff-id", role: "STAFF" },
        "Cancel after preparation started",
      ),
    ).rejects.toThrow("Staff may cancel only a PAID order");
  });
});


it('defers cancellation with unresolved payment without restoring stock or points',async()=>{
 const tx={ $queryRaw:vi.fn(),order:{findUnique:vi.fn().mockResolvedValue({id:'order',userId:'customer',status:'PENDING',payments:[{id:'payment',status:'UNKNOWN'}]})},paymentEvent:{findFirst:vi.fn().mockResolvedValue(null),create:vi.fn()},payment:{update:vi.fn()}};
 const inventory={restoreIngredientsForOrder:vi.fn()};const loyalty={returnRedeemedPoints:vi.fn()};
 const service=new OrderService({$transaction:vi.fn(work=>work(tx))} as unknown as PrismaService,inventory as unknown as InventoryService,loyalty as unknown as LoyaltyService);
 expect(await service.cancelOrder('order',{id:'customer',role:'CUSTOMER'})).toMatchObject({status:'PENDING',pendingCancellation:true});
 expect(inventory.restoreIngredientsForOrder).not.toHaveBeenCalled();expect(loyalty.returnRedeemedPoints).not.toHaveBeenCalled();expect(tx.paymentEvent.create).toHaveBeenCalledOnce();
});
