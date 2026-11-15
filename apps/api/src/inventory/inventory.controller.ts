import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { AdjustStockDto, CreateIngredientDto, CreateRecipeDto } from "./dto/inventory.dto.js";
import { InventoryService } from "./inventory.service.js";

@Controller("staff/inventory")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("MANAGER")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get("ingredients")
  listIngredients() {
    return this.inventoryService.listIngredients();
  }

  @Post("ingredients")
  createIngredient(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateIngredientDto,
  ) {
    return this.inventoryService.createIngredient(user.id, body);
  }

  @Patch("ingredients/:id/stock")
  adjustStock(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: AdjustStockDto,
  ) {
    return this.inventoryService.adjustStock(user.id, id, body);
  }

  @Post("recipes")
  createRecipe(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateRecipeDto) {
    return this.inventoryService.createRecipe(body, user.id);
  }

  @Get("history")
  history(@Query("ingredientId") ingredientId?: string) {
    return this.inventoryService.history(ingredientId);
  }

  @Get("catalog")
  catalog() { return this.inventoryService.catalog(); }

  @Get("recipes")
  listRecipes() {
    return this.inventoryService.listRecipes();
  }
}
