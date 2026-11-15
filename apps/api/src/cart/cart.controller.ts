import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { CartService } from "./cart.service.js";
import { AddCartItemDto, UpdateCartItemDto } from "./dto/cart-item.dto.js";

@Controller("cart")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("CUSTOMER")
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@CurrentUser() user: AuthenticatedUser) {
    return this.cartService.getCart(user.id);
  }

  @Post("items")
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: AddCartItemDto,
  ) {
    return this.cartService.addItem(user.id, body);
  }

  @Patch("items/:id")
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(user.id, id, body);
  }

  @Delete("items/:id")
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.cartService.removeItem(user.id, id);
  }
}
