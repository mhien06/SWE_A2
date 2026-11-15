import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type MeasurementUnit } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type {
  AdjustStockDto,
  CreateIngredientDto,
  CreateRecipeDto,
} from "./dto/inventory.dto.js";

export interface IngredientDeductionResult {
  sufficient: boolean;
  deductedItems: Array<{
    ingredientId: string;
    ingredientNameSnapshot: string;
    quantityDeducted: number;
    unitSnapshot: string;
  }>;
}

interface RequiredIngredient {
  ingredientId: string;
  ingredientNameSnapshot: string;
  unitSnapshot: MeasurementUnit;
  quantity: number;
  orderItemId: string;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  listIngredients() {
    return this.prisma.ingredient.findMany({
      orderBy: { name: "asc" },
    });
  }

  listRecipes() {
    return this.prisma.recipe.findMany({
      where: { isActive: true },
      orderBy: [{ productId: "asc" }, { version: "desc" }],
      include: {
        product: { select: { id: true, name: true } },
        productOption: { select: { id: true, name: true, type: true } },
        ingredients: { include: { ingredient: true } },
      },
    });
  }

  async createIngredient(actorUserId: string, input: CreateIngredientDto) {
    const initialStock = input.quantityOnHand ?? 0;
    const initialReason = input.reason?.trim();

    return this.prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.create({
        data: {
          name: input.name.trim(),
          unit: input.unit,
          quantityOnHand: initialStock,
          reorderLevel: input.reorderLevel ?? 0,
        },
      });
      if (initialStock > 0) {
        if (!initialReason) {
          throw new BadRequestException(
            "A reason is required when creating an ingredient with initial stock",
          );
        }
        await tx.inventoryAdjustment.create({
          data: {
            ingredientId: ingredient.id,
            actorUserId,
            quantityDelta: initialStock,
            reason: initialReason,
          },
        });
      }
      return ingredient;
    });
  }

  async adjustStock(
    actorUserId: string,
    ingredientId: string,
    input: AdjustStockDto,
  ) {
    if (!Number.isFinite(input.quantityDelta) || input.quantityDelta === 0) {
      throw new BadRequestException("quantityDelta must be a non-zero number");
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockIngredient(tx, ingredientId);
      const ingredient = await tx.ingredient.findUnique({
        where: { id: ingredientId },
      });
      if (!ingredient) {
        throw new NotFoundException("Ingredient not found");
      }

      const next = quantity(ingredient.quantityOnHand) + input.quantityDelta;
      if (next < 0) {
        throw new BadRequestException("Stock quantity cannot be negative");
      }

      const updated = await tx.ingredient.update({
        where: { id: ingredientId },
        data: { quantityOnHand: next },
      });
      await tx.inventoryAdjustment.create({
        data: {
          ingredientId,
          actorUserId,
          quantityDelta: input.quantityDelta,
          reason: input.reason.trim(),
        },
      });
      return updated;
    });
  }

  async createRecipe(input: CreateRecipeDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Product" WHERE "id" = CAST(${input.productId} AS uuid) FOR UPDATE`,
      );
      const product = await tx.product.findUnique({
        where: { id: input.productId },
        include: { options: true },
      });
      if (!product) {
        throw new NotFoundException("Product not found");
      }
      if (
        input.productOptionId &&
        !product.options.some((option) => option.id === input.productOptionId)
      ) {
        throw new BadRequestException(
          "Recipe option must belong to the selected product",
        );
      }

      const ingredientIds = input.ingredients.map((item) => item.ingredientId);
      if (new Set(ingredientIds).size !== ingredientIds.length) {
        throw new BadRequestException(
          "A recipe cannot contain the same ingredient more than once",
        );
      }
      const ingredients = await tx.ingredient.findMany({
        where: { id: { in: ingredientIds }, isActive: true },
      });
      if (ingredients.length !== new Set(ingredientIds).size) {
        throw new BadRequestException("Recipe contains an invalid ingredient");
      }
      const mismatch = input.ingredients.find((line) => {
        const ingredient = ingredients.find(
          (candidate) => candidate.id === line.ingredientId,
        );
        return ingredient && line.quantity <= 0;
      });
      if (mismatch) {
        throw new BadRequestException("Recipe quantities must be positive");
      }

      const activeWhere = {
        productId: input.productId,
        productOptionId: input.productOptionId ?? null,
        isActive: true,
      };
      const latest = await tx.recipe.findFirst({
        where: {
          productId: input.productId,
          productOptionId: input.productOptionId ?? null,
        },
        orderBy: { version: "desc" },
      });
      await tx.recipe.updateMany({
        where: activeWhere,
        data: { isActive: false },
      });

      return tx.recipe.create({
        data: {
          productId: input.productId,
          productOptionId: input.productOptionId ?? null,
          version: (latest?.version ?? 0) + 1,
          ingredients: {
            create: input.ingredients.map((line) => ({
              ingredientId: line.ingredientId,
              quantity: line.quantity,
              unit:
                ingredients.find(
                  (ingredient) => ingredient.id === line.ingredientId,
                )!.unit,
            })),
          },
        },
        include: { ingredients: { include: { ingredient: true } } },
      });
    });
  }

  async checkIngredientsForOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<boolean> {
    const requirement = await this.getRequirements(tx, orderId);
    if (!requirement) {
      return false;
    }
    const ingredientIds = [...requirement.totals.keys()].sort();
    for (const ingredientId of ingredientIds) {
      await this.lockIngredient(tx, ingredientId);
    }
    const stock = await tx.ingredient.findMany({
      where: {
        id: { in: ingredientIds },
        isActive: true,
      },
    });
    if (stock.length !== requirement.totals.size) {
      return false;
    }
    return stock.every(
      (ingredient) =>
        quantity(ingredient.quantityOnHand) >=
        requirement.totals.get(ingredient.id)!,
    );
  }

  async deductIngredientsForOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<IngredientDeductionResult> {
    const existing = await tx.orderIngredientUsage.findMany({
      where: { orderItem: { orderId } },
    });
    if (existing.length > 0) {
      const requirement = await this.getRequirements(tx, orderId);
      if (!requirement) {
        throw new ConflictException(
          "Ingredient usage exists but the order recipe is unavailable",
        );
      }
      const deducted = new Map<string, number>();
      for (const usage of existing) {
        deducted.set(
          usage.ingredientId,
          roundQuantity(
            (deducted.get(usage.ingredientId) ?? 0) +
              quantity(usage.quantityDeducted),
          ),
        );
      }
      if (
        deducted.size !== requirement.totals.size ||
        [...requirement.totals].some(
          ([ingredientId, amount]) => deducted.get(ingredientId) !== amount,
        )
      ) {
        throw new ConflictException(
          "Existing ingredient usage is inconsistent with the order recipe",
        );
      }
      return {
        sufficient: true,
        deductedItems: existing.map((usage) => ({
          ingredientId: usage.ingredientId,
          ingredientNameSnapshot: usage.ingredientNameSnapshot,
          quantityDeducted: quantity(usage.quantityDeducted),
          unitSnapshot: usage.unitSnapshot,
        })),
      };
    }

    const requirement = await this.getRequirements(tx, orderId);
    if (!requirement) {
      return { sufficient: false, deductedItems: [] };
    }

    const ingredientIds = [...requirement.totals.keys()].sort();
    for (const ingredientId of ingredientIds) {
      await this.lockIngredient(tx, ingredientId);
    }

    const ingredients = await tx.ingredient.findMany({
      where: { id: { in: ingredientIds }, isActive: true },
    });
    if (ingredients.length !== ingredientIds.length) {
      return { sufficient: false, deductedItems: [] };
    }
    if (
      ingredients.some(
        (ingredient) =>
          quantity(ingredient.quantityOnHand) <
          requirement.totals.get(ingredient.id)!,
      )
    ) {
      return { sufficient: false, deductedItems: [] };
    }

    for (const ingredient of ingredients) {
      const required = requirement.totals.get(ingredient.id)!;
      await tx.ingredient.update({
        where: { id: ingredient.id },
        data: {
          quantityOnHand: quantity(ingredient.quantityOnHand) - required,
        },
      });
    }

    await tx.orderIngredientUsage.createMany({
      data: requirement.lines.map((line) => ({
        orderItemId: line.orderItemId,
        ingredientId: line.ingredientId,
        ingredientNameSnapshot: line.ingredientNameSnapshot,
        quantityDeducted: line.quantity,
        unitSnapshot: line.unitSnapshot,
      })),
    });

    return {
      sufficient: true,
      deductedItems: requirement.lines.map((line) => ({
        ingredientId: line.ingredientId,
        ingredientNameSnapshot: line.ingredientNameSnapshot,
        quantityDeducted: line.quantity,
        unitSnapshot: line.unitSnapshot,
      })),
    };
  }

  async restoreIngredientsForOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    const usages = await tx.orderIngredientUsage.findMany({
      where: { orderItem: { orderId }, restoredAt: null },
      orderBy: [{ ingredientId: "asc" }, { id: "asc" }],
    });
    const ingredientIds = [...new Set(usages.map((usage) => usage.ingredientId))];
    for (const ingredientId of ingredientIds) {
      await this.lockIngredient(tx, ingredientId);
    }

    for (const usage of usages) {
      const alreadyRestored = await tx.orderIngredientUsage.findUnique({
        where: { id: usage.id },
      });
      if (!alreadyRestored || alreadyRestored.restoredAt) {
        continue;
      }
      const restored = quantity(alreadyRestored.quantityDeducted) -
        quantity(alreadyRestored.quantityRestored);
      if (restored <= 0) {
        continue;
      }
      await tx.ingredient.update({
        where: { id: usage.ingredientId },
        data: {
          quantityOnHand: { increment: restored },
        },
      });
      await tx.orderIngredientUsage.update({
        where: { id: usage.id },
        data: {
          quantityRestored: alreadyRestored.quantityDeducted,
          restoredAt: new Date(),
          restoreIdempotencyKey: `restore:${orderId}:${usage.id}`,
        },
      });
    }
    return usages.length;
  }

  private async getRequirements(tx: Prisma.TransactionClient, orderId: string) {
    const items = await tx.orderItem.findMany({
      where: { orderId },
      include: {
        product: {
          include: {
            options: { where: { isAvailable: true } },
            recipes: {
              where: { isActive: true },
              orderBy: { version: "desc" },
              include: {
                ingredients: { include: { ingredient: true } },
              },
            },
          },
        },
      },
    });
    if (items.length === 0) {
      return null;
    }

    const lines: RequiredIngredient[] = [];
    for (const item of items) {
      const size = item.product.options.find(
        (option) =>
          option.type === "SIZE" &&
          option.name === item.selectedSizeSnapshot,
      );
      if (!size) {
        return null;
      }
      const selectedOptions = [
        size,
        ...item.product.options.filter(
          (option) =>
            option.type === "TOPPING" &&
            item.selectedToppingsSnapshot.includes(option.name),
        ),
      ];
      const activeRecipes = item.product.recipes;
      const baseRecipe = activeRecipes.find(
        (recipe) => recipe.productOptionId === null,
      );
      const variantRecipes = selectedOptions
        .map((option) =>
          activeRecipes.find((recipe) => recipe.productOptionId === option.id),
        )
        .filter((recipe) => recipe !== undefined);
      if (!baseRecipe && variantRecipes.length === 0) {
        return null;
      }

      for (const recipe of [baseRecipe, ...variantRecipes]) {
        if (!recipe) {
          continue;
        }
        for (const ingredientLine of recipe.ingredients) {
          lines.push({
            ingredientId: ingredientLine.ingredientId,
            ingredientNameSnapshot: ingredientLine.ingredient.name,
            unitSnapshot: ingredientLine.unit,
            quantity: roundQuantity(
              quantity(ingredientLine.quantity) * item.quantity,
            ),
            orderItemId: item.id,
          });
        }
      }
    }

    const totals = new Map<string, number>();
    for (const line of lines) {
      totals.set(
        line.ingredientId,
        roundQuantity((totals.get(line.ingredientId) ?? 0) + line.quantity),
      );
    }
    return { lines, totals };
  }

  private async lockIngredient(tx: Prisma.TransactionClient, ingredientId: string) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Ingredient" WHERE "id" = CAST(${ingredientId} AS uuid) FOR UPDATE`,
    );
  }
}

function quantity(value: { toString(): string }) {
  return Number(value.toString());
}

function roundQuantity(value: number) {
  return Number(value.toFixed(3));
}
