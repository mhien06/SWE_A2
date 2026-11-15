import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class AddCartItemDto {
  @IsUUID("4")
  productId!: string;

  @IsUUID("4")
  sizeOptionId!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @IsUUID("4", { each: true })
  toppingOptionIds?: string[];

  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;
}

export class UpdateCartItemDto {
  @IsOptional()
  @IsUUID("4")
  sizeOptionId?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @IsUUID("4", { each: true })
  toppingOptionIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  quantity?: number;
}
