import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreatePaymentDto {
  @IsUUID("4")
  orderId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

export class CreateOrderPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}
