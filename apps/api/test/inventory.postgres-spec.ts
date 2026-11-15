import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../src/generated/prisma/client.js';
import { ProductService } from '../src/product/product.service.js';
import { OrderService } from '../src/order/order.service.js';
import { LoyaltyService } from '../src/loyalty/loyalty.service.js';
import { InventoryService } from '../src/inventory/inventory.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

const url = process.env.INVENTORY_TEST_DATABASE_URL;
if (
  !url ||
  !/^brewlite_inventory_test(?:_[a-z0-9]+)?$/.test(
    new URL(url).pathname.slice(1),
  )
) {
  throw new Error(
    'Set INVENTORY_TEST_DATABASE_URL to a dedicated brewlite_inventory_test database; never use development data',
  );
}
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});
const service = new InventoryService(db as unknown as PrismaService);
let userId: string;
beforeAll(async () => {
  const user = await db.user.create({
    data: {
      email: `${randomUUID()}@inventory.test`,
      name: 'Inventory test',
      passwordHash: 'not-a-login',
      role: 'MANAGER',
    },
  });
  userId = user.id;
});
afterAll(async () => {
  await db.$disconnect();
});

async function fixture(stock = 10) {
  const ingredient = await db.ingredient.create({
    data: { name: randomUUID(), unit: 'GRAM', quantityOnHand: stock },
  });
  const product = await db.product.create({
    data: {
      name: 'Test drink',
      description: 'Isolated inventory fixture',
      basePrice: 10000,
      options: {
        create: [
          { type: 'SIZE', name: 'S', additionalPrice: 0 },
          { type: 'TOPPING', name: 'Pearls', additionalPrice: 1000 },
        ],
      },
    },
    include: { options: true },
  });
  await service.createRecipe(
    {
      productId: product.id,
      ingredients: [{ ingredientId: ingredient.id, quantity: 7 }],
    },
    userId,
  );
  const makeOrder = async (toppings: string[] = []) =>
    db.order.create({
      data: {
        orderCode: randomUUID(),
        userId,
        subtotal: 10000,
        totalAmount: 10000,
        vnpayPayableAmount: 10000,
        expiresAt: new Date(Date.now() + 900000),
        items: {
          create: {
            productId: product.id,
            productNameSnapshot: product.name,
            selectedSizeSnapshot: 'S',
            selectedToppingsSnapshot: toppings,
            unitPriceSnapshot: 10000,
            quantity: 1,
            lineTotal: 10000,
          },
        },
      },
    });
  return { ingredient, product, makeOrder };
}
const deduct = (id: string) =>
  db.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "Order" WHERE id = CAST(${id} AS uuid) FOR UPDATE`,
    );
    return service.deductIngredientsForOrder(tx, id);
  });

describe('Inventory on isolated PostgreSQL', () => {
  it('requires base and non-S size recipes, then adds base and topping quantities', async () => {
    const f = await fixture(30);
    const order = await f.makeOrder(['Pearls']);
    const topping = f.product.options.find((o) => o.type === 'TOPPING')!;
    await service.createRecipe(
      {
        productId: f.product.id,
        productOptionId: topping.id,
        ingredients: [{ ingredientId: f.ingredient.id, quantity: 2 }],
      },
      userId,
    );
    await db.recipe.updateMany({
      where: { productId: f.product.id, productOptionId: null },
      data: { isActive: false },
    });
    expect((await deduct(order.id)).sufficient).toBe(false);
    await db.recipe.updateMany({
      where: { productId: f.product.id, productOptionId: null },
      data: { isActive: true },
    });
    await db.productOption.create({
      data: {
        productId: f.product.id,
        name: 'M',
        type: 'SIZE',
        additionalPrice: 1000,
      },
    });
    await db.orderItem.updateMany({
      where: { orderId: order.id },
      data: { selectedSizeSnapshot: 'M' },
    });
    expect((await deduct(order.id)).sufficient).toBe(false);
    await db.orderItem.updateMany({
      where: { orderId: order.id },
      data: { selectedSizeSnapshot: 'S' },
    });
    expect((await deduct(order.id)).sufficient).toBe(true);
    expect(
      Number(
        (
          await db.ingredient.findUniqueOrThrow({
            where: { id: f.ingredient.id },
          })
        ).quantityOnHand,
      ),
    ).toBe(21);
  });
  it('does not partially deduct when a selected topping recipe is missing or unavailable', async () => {
    const f = await fixture();
    const order = await f.makeOrder(['Pearls']);
    expect((await deduct(order.id)).sufficient).toBe(false);
    await db.productOption.update({
      where: { id: f.product.options.find((o) => o.type === 'TOPPING')!.id },
      data: { isAvailable: false },
    });
    expect((await deduct(order.id)).sufficient).toBe(false);
    expect(
      Number(
        (
          await db.ingredient.findUniqueOrThrow({
            where: { id: f.ingredient.id },
          })
        ).quantityOnHand,
      ),
    ).toBe(10);
    expect(
      await db.orderIngredientUsage.count({
        where: { orderItem: { orderId: order.id } },
      }),
    ).toBe(0);
  });
  it('serializes competing orders so only one can consume limited stock', async () => {
    const f = await fixture();
    const a = await f.makeOrder();
    const b = await f.makeOrder();
    const results = await Promise.all([deduct(a.id), deduct(b.id)]);
    expect(results.filter((r) => r.sufficient)).toHaveLength(1);
    expect(
      Number(
        (
          await db.ingredient.findUniqueOrThrow({
            where: { id: f.ingredient.id },
          })
        ).quantityOnHand,
      ),
    ).toBe(3);
  });
  it('restores the original deduction once after the recipe changes, even concurrently', async () => {
    const f = await fixture();
    const order = await f.makeOrder();
    await deduct(order.id);
    await service.createRecipe(
      {
        productId: f.product.id,
        ingredients: [{ ingredientId: f.ingredient.id, quantity: 2 }],
      },
      userId,
    );
    const restore = () =>
      db.$transaction((tx) => service.restoreIngredientsForOrder(tx, order.id));
    await Promise.all([restore(), restore()]);
    expect(
      Number(
        (
          await db.ingredient.findUniqueOrThrow({
            where: { id: f.ingredient.id },
          })
        ).quantityOnHand,
      ),
    ).toBe(10);
    const usages = await db.orderIngredientUsage.findMany({
      where: { orderItem: { orderId: order.id } },
    });
    expect(Number(usages[0].quantityRestored)).toBe(7);
    const versions = await db.recipe.findMany({
      where: { productId: f.product.id },
      orderBy: { version: 'asc' },
    });
    expect(
      versions.map((r) => [r.version, r.isActive, r.createdByUserId]),
    ).toEqual([
      [1, false, userId],
      [2, true, userId],
    ]);
  });
  it('rolls back stock and usage together on a failed transaction', async () => {
    const f = await fixture();
    const order = await f.makeOrder();
    await expect(
      db.$transaction(async (tx) => {
        await service.deductIngredientsForOrder(tx, order.id);
        throw new Error('injected write failure');
      }),
    ).rejects.toThrow('injected write failure');
    expect(
      Number(
        (
          await db.ingredient.findUniqueOrThrow({
            where: { id: f.ingredient.id },
          })
        ).quantityOnHand,
      ),
    ).toBe(10);
    expect(
      await db.orderIngredientUsage.count({
        where: { orderItem: { orderId: order.id } },
      }),
    ).toBe(0);
  });
  it('rejects negative stock and exposes adjustment history with actor', async () => {
    const f = await fixture();
    await expect(
      service.adjustStock(userId, f.ingredient.id, {
        quantityDelta: -11,
        reason: 'test',
      }),
    ).rejects.toThrow('negative');
    await service.adjustStock(userId, f.ingredient.id, {
      quantityDelta: 2,
      reason: 'Test receipt',
    });
    expect(await service.history(f.ingredient.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'ADJUST',
          delta: 2,
          actor: 'Inventory test',
          reason: 'Test receipt',
        }),
      ]),
    );
  });
});

describe('Operations audit on PostgreSQL', () => {
  it('preserves order snapshots when manager edits product and records actor/reason', async () => {
    const f = await fixture();
    const order = await f.makeOrder();
    const products = new ProductService(db as unknown as PrismaService);
    await products.saveProduct(f.product.id, userId, {
      name: 'Updated drink',
      description: 'New description',
      basePrice: 35000,
      reason: 'New menu',
    });
    await products.setAvailability(
      f.product.id,
      userId,
      false,
      'Out of season',
    );
    const history = await products.history(f.product.id);
    expect(history).toHaveLength(2);
    expect(history.every((row) => row.actor === 'Inventory test')).toBe(true);
    const item = await db.orderItem.findFirstOrThrow({
      where: { orderId: order.id },
    });
    expect(item.productNameSnapshot).toBe('Test drink');
    expect(item.unitPriceSnapshot).toBe(10000);
  });
  it('serializes concurrent staff transitions and records only one actor event', async () => {
    const f = await fixture();
    const order = await f.makeOrder();
    await db.order.update({
      where: { id: order.id },
      data: { status: 'PAID' },
    });
    const orders = new OrderService(
      db as unknown as PrismaService,
      service,
      {} as LoyaltyService,
    );
    const results = await Promise.allSettled([
      orders.updateStaffStatus(order.id, 'PREPARING', userId),
      orders.updateStaffStatus(order.id, 'PREPARING', userId),
    ]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    const audit = await orders.audit(order.id);
    expect(audit.statusChanges).toHaveLength(1);
    expect(audit.statusChanges[0]?.actor).toBe('Inventory test');
    await expect(
      orders.updateStaffStatus(order.id, 'COMPLETED', userId),
    ).rejects.toThrow();
    expect(
      await db.orderStatusChange.count({ where: { orderId: order.id } }),
    ).toBe(1);
  });
});


describe('Points-only checkout on PostgreSQL', () => {
  it('deducts points and stock atomically; staff cancellation returns both once without VNPay compensation', async () => {
    const previousRate = process.env.LOYALTY_REDEEM_VND_PER_POINT;
    process.env.LOYALTY_REDEEM_VND_PER_POINT = '100';
    try {
      const f = await fixture(20);
      const customer = await db.user.create({data:{name:'Points customer',email:`${randomUUID()}@points.test`,passwordHash:'not-a-login',pointsBalance:200}});
      await db.cart.create({data:{userId:customer.id,items:{create:{productId:f.product.id,selectedSize:'S',selectedToppings:[],quantity:1,estimatedUnitPrice:10000}}}});
      const orders = new OrderService(db as unknown as PrismaService,service,new LoyaltyService(db as unknown as PrismaService));
      await expect(orders.createOrder(customer.id,{pointsRedeemed:100,expectedSubtotal:9999})).rejects.toThrow('Giá');
      expect(await db.order.count({where:{userId:customer.id}})).toBe(0);
      const order = await orders.createOrder(customer.id,{pointsRedeemed:100,expectedSubtotal:10000,expectedPointsDiscount:10000});
      expect(order.status).toBe('PAID');expect(order.vnpayPayableAmount).toBe(0);
      expect(await db.payment.count({where:{orderId:order.id}})).toBe(0);
      expect(Number((await db.ingredient.findUniqueOrThrow({where:{id:f.ingredient.id}})).quantityOnHand)).toBe(13);
      await orders.cancelOrder(order.id,{id:userId,role:'MANAGER'},'Khách yêu cầu hủy');
      await orders.cancelOrder(order.id,{id:userId,role:'MANAGER'},'Khách yêu cầu hủy');
      expect((await db.user.findUniqueOrThrow({where:{id:customer.id}})).pointsBalance).toBe(200);
      expect(Number((await db.ingredient.findUniqueOrThrow({where:{id:f.ingredient.id}})).quantityOnHand)).toBe(20);
      expect((await db.loyaltyTransaction.findMany({where:{orderId:order.id}})).map(row=>row.type).sort()).toEqual(['REDEEM','RETURN_REDEEMED']);
    } finally { if(previousRate===undefined)delete process.env.LOYALTY_REDEEM_VND_PER_POINT;else process.env.LOYALTY_REDEEM_VND_PER_POINT=previousRate; }
  });
});
