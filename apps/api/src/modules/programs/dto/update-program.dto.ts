import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { AgeGroup, PricingType } from '../../../mock-data/mock-data.types';

const AGE_GROUPS: AgeGroup[] = ['ALL', 'CHILD', 'TEEN', 'ADULT', 'SENIOR'];
const PRICING_TYPES: PricingType[] = ['FREE_ACCESS', 'PAID_SESSION', 'PT_PACKAGE'];

// status는 이 DTO로 바꿀 수 없다 — 전용 UpdateProgramStatusDto/엔드포인트를 쓴다(07문서 §5).
export class UpdateProgramDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  category?: string;

  @IsOptional()
  @IsIn(AGE_GROUPS)
  ageGroup?: AgeGroup;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(PRICING_TYPES)
  pricingType?: PricingType;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

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

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
