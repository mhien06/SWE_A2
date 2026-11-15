import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  ProductOptionType,
} from "../src/generated/prisma/client.js";

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

async function seed() {
  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        name: product.name,
        description: product.description,
        basePrice: product.basePrice,
        isAvailable: true,
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
          isAvailable: true,
        },
        create: {
          ...option,
          productId: product.id,
          isAvailable: true,
        },
      });
    }
  }
}

seed()
  .then(() => console.log(`Seeded ${products.length} BrewLite products`))
  .finally(async () => prisma.$disconnect());
