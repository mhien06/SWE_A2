import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class OrderQuoteDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  pointsRedeemed = 0;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @Max(500)
  reason?: string;
}

export class StaffOrderStatusDto {
  @IsIn(["PREPARING", "READY_FOR_PICKUP", "COMPLETED"])
  status!: string;
}
