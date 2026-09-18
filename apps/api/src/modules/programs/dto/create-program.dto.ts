import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { AgeGroup, PricingType } from '../../../mock-data/mock-data.types';

const AGE_GROUPS: AgeGroup[] = ['ALL', 'CHILD', 'TEEN', 'ADULT', 'SENIOR'];
const PRICING_TYPES: PricingType[] = ['FREE_ACCESS', 'PAID_SESSION', 'PT_PACKAGE'];

export class CreateProgramDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  category!: string;

  @IsIn(AGE_GROUPS)
  ageGroup!: AgeGroup;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(PRICING_TYPES)
  pricingType!: PricingType;

  // FREE_ACCESS면 서버가 무시하고 0/undefined로 강제 정규화한다(mock-data.service.ts 참고).
  @IsInt()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @IsString()
  facilityId?: string;

  @IsOptional()
  @IsString()
  instructorId?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
