import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { MeasurementUnit } from "../../generated/prisma/client.js";

export class CreateIngredientDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsEnum(MeasurementUnit)
  unit!: MeasurementUnit;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantityOnHand?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  reorderLevel?: number;

  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(500)
  reason?: string;
}

export class AdjustStockDto {
  @IsNumber({ maxDecimalPlaces: 3 })
  quantityDelta!: number;

  @IsString()
  @Matches(/\S/)
  @MaxLength(500)
  reason!: string;
}

export class RecipeIngredientDto {
  @IsUUID("4")
  ingredientId!: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;
}

export class CreateRecipeDto {
  @IsUUID("4")
  productId!: string;

  @IsOptional()
  @IsUUID("4")
  productOptionId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients!: RecipeIngredientDto[];
}
