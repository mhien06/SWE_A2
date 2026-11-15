import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class OrderQuoteDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  pointsRedeemed = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedSubtotal?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedPointsDiscount?: number;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class StaffOrderStatusDto {
  @IsIn(["PREPARING", "READY_FOR_PICKUP", "COMPLETED"])
  status!: string;
}
