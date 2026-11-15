import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AddCartItemDto, UpdateCartItemDto } from "./dto/cart-item.dto.js";

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
          include: { product: { include: { options: true } } },
        },
      },
    });
    if (!cart) {
      throw new NotFoundException("Cart not found");
    }

    const items = cart.items.map((item) => {
      const size = item.product.options.find(
        (option) =>
          option.type === "SIZE" &&
          option.name === item.selectedSize &&
          option.isAvailable,
      );
      const toppings = item.product.options.filter(
        (option) =>
          option.type === "TOPPING" &&
          item.selectedToppings.includes(option.name) &&
          option.isAvailable,
      );
      const unitPrice =
        price(item.product.basePrice) +
        (size ? price(size.additionalPrice) : 0) +
        toppings.reduce((total, option) => total + price(option.additionalPrice), 0);

      return {
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        productIsAvailable: item.product.isAvailable,
        sizeOptionId: size?.id ?? null,
        toppingOptionIds: toppings.map((option) => option.id),
        selectedSize: item.selectedSize,
        selectedToppings: item.selectedToppings,
        availableSizes: item.product.options
          .filter((option) => option.type === "SIZE" && option.isAvailable)
          .map((option) => ({
            id: option.id,
            name: option.name,
            additionalPrice: price(option.additionalPrice),
          })),
        availableToppings: item.product.options
          .filter((option) => option.type === "TOPPING" && option.isAvailable)
          .map((option) => ({
            id: option.id,
            name: option.name,
            additionalPrice: price(option.additionalPrice),
          })),
        quantity: item.quantity,
        unitPrice,
        lineTotal: unitPrice * item.quantity,
      };
    });

    return {
      id: cart.id,
      items,
      total: items.reduce((total, item) => total + item.lineTotal, 0),
    };
  }

  async addItem(userId: string, input: AddCartItemDto) {
    const cart = await this.requireCart(userId);
    const selection = await this.validateSelection(
      input.productId,
      input.sizeOptionId,
      input.toppingOptionIds ?? [],
    );

    await this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: input.productId,
        selectedSize: selection.size.name,
        selectedToppings: selection.toppings.map((option) => option.name),
        quantity: input.quantity,
        estimatedUnitPrice: selection.unitPrice,
      },
    });
    return this.getCart(userId);
  }

  async updateItem(
    userId: string,
    itemId: string,
    input: UpdateCartItemDto,
  ) {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException("At least one cart item field is required");
    }
    const cart = await this.requireCart(userId);
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });
    if (!item) {
      throw new NotFoundException("Cart item not found");
    }

    const options = await this.prisma.productOption.findMany({
      where: { productId: item.productId, isAvailable: true },
    });
    const size = input.sizeOptionId
      ? options.find((option) => option.id === input.sizeOptionId)
      : options.find(
          (option) =>
            option.type === "SIZE" && option.name === item.selectedSize,
        );
    const toppingNames = input.toppingOptionIds
      ? input.toppingOptionIds.map((id) => {
          const option = options.find(
            (candidate) =>
              candidate.id === id && candidate.type === "TOPPING",
          );
          if (!option) {
            throw new BadRequestException("Invalid topping option");
          }
          return option.name;
        })
      : item.selectedToppings;

    if (!size || size.type !== "SIZE") {
      throw new BadRequestException("A valid size option is required");
    }
    const toppings = options.filter(
      (option) =>
        option.type === "TOPPING" && toppingNames.includes(option.name),
    );
    if (toppings.length !== toppingNames.length) {
      throw new BadRequestException("One or more topping options are unavailable");
    }

    const product = await this.prisma.product.findUnique({
      where: { id: item.productId },
      select: { basePrice: true, isAvailable: true },
    });
    if (!product || !product.isAvailable) {
      throw new BadRequestException("Product is not available");
    }
    const unitPrice =
      price(product.basePrice) +
      price(size.additionalPrice) +
      toppings.reduce((total, option) => total + price(option.additionalPrice), 0);

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: {
        selectedSize: size.name,
        selectedToppings: toppings.map((option) => option.name),
        quantity: input.quantity ?? item.quantity,
        estimatedUnitPrice: unitPrice,
      },
    });
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.requireCart(userId);
    const deleted = await this.prisma.cartItem.deleteMany({
      where: { id: itemId, cartId: cart.id },
    });
    if (deleted.count !== 1) {
      throw new NotFoundException("Cart item not found");
    }
    return this.getCart(userId);
  }

  private async requireCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      throw new NotFoundException("Cart not found");
    }
    return cart;
  }

  private async validateSelection(
    productId: string,
    sizeOptionId: string,
    toppingOptionIds: string[],
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { options: { where: { isAvailable: true } } },
    });
    if (!product || !product.isAvailable) {
      throw new NotFoundException("Product is not available");
    }

    const size = product.options.find(
      (option) => option.id === sizeOptionId && option.type === "SIZE",
    );
    if (!size) {
      throw new BadRequestException("A valid size option is required");
    }

    const toppings = toppingOptionIds.map((id) => {
      const option = product.options.find(
        (candidate) => candidate.id === id && candidate.type === "TOPPING",
      );
      if (!option) {
        throw new BadRequestException("One or more topping options are invalid");
      }
      return option;
    });

    return {
      size,
      toppings,
      unitPrice:
        price(product.basePrice) +
        price(size.additionalPrice) +
        toppings.reduce((total, option) => total + price(option.additionalPrice), 0),
    };
  }
}

function price(value: { toString(): string }) {
  const amount = Number(value.toString());
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error("Product prices must be whole, non-negative VND amounts");
  }
  return amount;
}
