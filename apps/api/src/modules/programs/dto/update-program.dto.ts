import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { INPUT_LIMITS } from '../../../common/validation/input-limits';
import { AgeGroup, PricingType } from '../../../fixtures/mock-data.types';

const AGE_GROUPS: AgeGroup[] = ['ALL', 'CHILD', 'TEEN', 'ADULT', 'SENIOR'];
const PRICING_TYPES: PricingType[] = ['FREE_ACCESS', 'PAID_SESSION', 'PT_PACKAGE'];

// status는 이 DTO로 바꿀 수 없다 — 전용 UpdateProgramStatusDto/엔드포인트를 쓴다(강사프로그램게시 A-5).
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
  @Max(INPUT_LIMITS.PRICE_WON)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(INPUT_LIMITS.HEADCOUNT)
  capacity?: number;

  // 예약및결제 ADR-RSV-09 — PT_PACKAGE 패키지 1개의 횟수(있으면 회원 앱에서 살 수 있다). 다른 형이면 서버가 비운다.
  // 수정에서 0은 "비움"(앱 판매 중단).
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(INPUT_LIMITS.PT_SESSIONS)
  ptPackageSessions?: number;

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
