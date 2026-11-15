import { IsInt, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
export class ManageProductDto {
  @IsString() @Matches(/\S/) @MaxLength(100) name!: string;
  @IsString() @MaxLength(1000) description!: string;
  @IsInt() @Min(5000) @Max(100000000) basePrice!: number;
  @IsString() @Matches(/\S/) @MaxLength(500) reason!: string;
}
