import { IsBoolean, IsString, Matches, MaxLength } from "class-validator";

export class SetProductAvailabilityDto {
  @IsBoolean()
  isAvailable!: boolean;

  @IsString()
  @Matches(/\S/)
  @MaxLength(500)
  reason!: string;
}
