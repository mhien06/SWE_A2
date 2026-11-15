import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  MeasurementUnit,
  ProductOptionType,
  UserRole,
} from "../src/generated/prisma/client.js";
import { hash } from "bcryptjs";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the catalog");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const products = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Cà phê sữa",
    description: "Cà phê đậm vị hòa cùng sữa đặc ngọt dịu.",
    basePrice: 29000,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Bạc xỉu",
    description: "Nhiều sữa, ít cà phê, mềm mại và dễ uống.",
    basePrice: 32000,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Trà đào",
    description: "Trà thanh mát kết hợp đào thơm và vị chua nhẹ.",
    basePrice: 35000,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Matcha latte",
    description: "Matcha thơm dịu hòa quyện cùng sữa tươi.",
    basePrice: 39000,
  },
] as const;

const options = [
  { type: ProductOptionType.SIZE, name: "S", additionalPrice: 0 },
  { type: ProductOptionType.SIZE, name: "M", additionalPrice: 5000 },
  { type: ProductOptionType.SIZE, name: "L", additionalPrice: 10000 },
  {
    type: ProductOptionType.TOPPING,
    name: "Trân châu",
    additionalPrice: 8000,
  },
  {
    type: ProductOptionType.TOPPING,
    name: "Kem sữa",
    additionalPrice: 10000,
  },
  {
    type: ProductOptionType.TOPPING,
    name: "Thạch cà phê",
    additionalPrice: 7000,
  },
] as const;

const ingredients = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", name: "Hạt cà phê", unit: MeasurementUnit.GRAM },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", name: "Sữa tươi", unit: MeasurementUnit.MILLILITER },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3", name: "Sữa đặc", unit: MeasurementUnit.MILLILITER },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4", name: "Trà đen", unit: MeasurementUnit.GRAM },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5", name: "Đào", unit: MeasurementUnit.GRAM },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6", name: "Bột matcha", unit: MeasurementUnit.GRAM },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7", name: "Trân châu", unit: MeasurementUnit.GRAM },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8", name: "Kem sữa", unit: MeasurementUnit.GRAM },
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9", name: "Thạch cà phê", unit: MeasurementUnit.GRAM },
] as const;

const recipes = [
  {
    productId: products[0].id,
    base: [["Hạt cà phê", 18], ["Sữa tươi", 120], ["Sữa đặc", 25]],
    sizeAdds: { M: [["Hạt cà phê", 4], ["Sữa tươi", 30]], L: [["Hạt cà phê", 8], ["Sữa tươi", 60]] },
  },
  {
    productId: products[1].id,
    base: [["Hạt cà phê", 12], ["Sữa tươi", 160], ["Sữa đặc", 20]],
    sizeAdds: { M: [["Hạt cà phê", 3], ["Sữa tươi", 30]], L: [["Hạt cà phê", 6], ["Sữa tươi", 60]] },
  },
  {
    productId: products[2].id,
    base: [["Trà đen", 5], ["Đào", 60]],
    sizeAdds: { M: [["Trà đen", 1], ["Đào", 15]], L: [["Trà đen", 2], ["Đào", 30]] },
  },
  {
    productId: products[3].id,
    base: [["Bột matcha", 4], ["Sữa tươi", 180]],
    sizeAdds: { M: [["Bột matcha", 1], ["Sữa tươi", 30]], L: [["Bột matcha", 2], ["Sữa tươi", 60]] },
  },
] as const;

async function seed() {
  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        name: product.name,
        description: product.description,
        basePrice: product.basePrice,
      },
      create: {
        ...product,
        isAvailable: true,
      },
    });

    for (const option of options) {
      await prisma.productOption.upsert({
        where: {
          productId_type_name: {
            productId: product.id,
            type: option.type,
            name: option.name,
          },
        },
        update: {
          additionalPrice: option.additionalPrice,
        },
        create: {
          ...option,
          productId: product.id,
          isAvailable: true,
        },
      });
    }
  }

  for (const ingredient of ingredients) {
    await prisma.ingredient.upsert({
      where: { id: ingredient.id },
      update: {
        name: ingredient.name,
        unit: ingredient.unit,
        isActive: true,
      },
      create: {
        ...ingredient,
        quantityOnHand: 10000,
        reorderLevel: 100,
      },
    });
  }

  const ingredientByName = new Map<string, (typeof ingredients)[number]>(
    ingredients.map((ingredient) => [ingredient.name, ingredient]),
  );
  const baseByProduct = new Map(recipes.map((recipe) => [recipe.productId, recipe]));

  for (const product of products) {
    const recipe = baseByProduct.get(product.id);
    if (!recipe) {
      throw new Error(`Missing seed recipe for product ${product.id}`);
    }

    await upsertRecipe(product.id, null, recipe.base);
    const productOptions = await prisma.productOption.findMany({
      where: { productId: product.id },
    });
    for (const option of productOptions) {
      if (option.type === ProductOptionType.SIZE && option.name !== "S") {
        const additions = recipe.sizeAdds[option.name as "M" | "L"];
        if (additions) {
          await upsertRecipe(product.id, option.id, additions);
        }
      }
      if (option.type === ProductOptionType.TOPPING) {
        const toppingIngredient = ingredientByName.get(option.name);
        if (toppingIngredient) {
          await upsertRecipe(product.id, option.id, [[toppingIngredient.name, 20]]);
        }
      }
    }
  }

  const managerEmail = process.env.SEED_MANAGER_EMAIL?.trim().toLowerCase();
  const managerPassword = process.env.SEED_MANAGER_PASSWORD;
  if (Boolean(managerEmail) !== Boolean(managerPassword)) {
    throw new Error("Set both SEED_MANAGER_EMAIL and SEED_MANAGER_PASSWORD to seed a manager");
  }
  if (managerEmail && managerPassword) {
    const passwordHash = await hash(managerPassword, 12);
    const manager = await prisma.user.upsert({
      where: { email: managerEmail },
      update: { passwordHash, role: UserRole.MANAGER, status: "ACTIVE" },
      create: {
        email: managerEmail,
        name: "BrewLite Manager",
        passwordHash,
        role: UserRole.MANAGER,
      },
    });
    await prisma.cart.upsert({
      where: { userId: manager.id },
      update: {},
      create: { userId: manager.id },
    });
  }

  async function upsertRecipe(
    productId: string,
    productOptionId: string | null,
    lines: readonly (readonly [string, number])[],
  ) {
    const latest = await prisma.recipe.findFirst({
      where: { productId, productOptionId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    if (latest && latest.version > 1) {
      return;
    }

    await prisma.recipe.updateMany({
      where: { productId, productOptionId, isActive: true },
      data: { isActive: false },
    });
    const existing = await prisma.recipe.findFirst({
      where: { productId, productOptionId, version: 1 },
    });
    const recipe = existing
      ? await prisma.recipe.update({
          where: { id: existing.id },
          data: { isActive: true },
        })
      : await prisma.recipe.create({
          data: { productId, productOptionId, version: 1, isActive: true },
        });

    await prisma.recipeIngredient.deleteMany({
      where: { recipeId: recipe.id },
    });
    await prisma.recipeIngredient.createMany({
      data: lines.map(([name, quantity]) => {
        const ingredient = ingredientByName.get(name);
        if (!ingredient) {
          throw new Error(`Missing seed ingredient: ${name}`);
        }
        return {
          recipeId: recipe.id,
          ingredientId: ingredient.id,
          quantity,
          unit: ingredient.unit,
        };
      }),
    });
  }
}

seed()
  .then(() => console.log(`Seeded ${products.length} BrewLite products`))
  .finally(async () => prisma.$disconnect());
