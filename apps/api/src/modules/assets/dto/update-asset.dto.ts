import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { INPUT_LIMITS } from '../../../common/validation/input-limits';

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(INPUT_LIMITS.QUANTITY)
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(INPUT_LIMITS.USEFUL_LIFE_YEARS)
  usefulLifeYears?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
