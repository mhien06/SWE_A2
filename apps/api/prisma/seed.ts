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
    name: "CÃ  phÃª sá»¯a",
    description: "CÃ  phÃª Ä‘áº­m vá»‹ hÃ²a cÃ¹ng sá»¯a Ä‘áº·c ngá»t dá»‹u.",
    basePrice: 29000,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Báº¡c xá»‰u",
    description: "Nhiá»u sá»¯a, Ã­t cÃ  phÃª, má»m máº¡i vÃ  dá»… uá»‘ng.",
    basePrice: 32000,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "TrÃ  Ä‘Ã o",
    description: "TrÃ  thanh mÃ¡t káº¿t há»£p Ä‘Ã o thÆ¡m vÃ  vá»‹ chua nháº¹.",
    basePrice: 35000,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Matcha latte",
    description: "Matcha thÆ¡m dá»‹u hÃ²a quyá»‡n cÃ¹ng sá»¯a tÆ°Æ¡i.",
    basePrice: 39000,
  },
] as const;

const options = [
  { type: ProductOptionType.SIZE, name: "S", additionalPrice: 0 },
  { type: ProductOptionType.SIZE, name: "M", additionalPrice: 5000 },
  { type: ProductOptionType.SIZE, name: "L", additionalPrice: 10000 },
  {
    type: ProductOptionType.TOPPING,
    name: "TrÃ¢n chÃ¢u",
    additionalPrice: 8000,
  },
  {
    type: ProductOptionType.TOPPING,
    name: "Kem sá»¯a",
    additionalPrice: 10000,
  },
  {
    type: ProductOptionType.TOPPING,
    name: "Tháº¡ch cÃ  phÃª",
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

    await prisma.productOption.deleteMany({
      where: { productId: product.id },
    });

    await prisma.productOption.createMany({
      data: options.map((option) => ({
        ...option,
        productId: product.id,
        isAvailable: true,
      })),
    });
  }
}

seed()
  .then(() => console.log(`Seeded ${products.length} BrewLite products`))
  .finally(async () => prisma.$disconnect());
