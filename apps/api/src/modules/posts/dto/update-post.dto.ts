import { IsIn, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { PostCategory } from '../../../fixtures/mock-data.types';

const CATEGORIES: PostCategory[] = ['NOTICE', 'TRAINING_MATERIAL', 'EVENT', 'OTHER'];

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: PostCategory;

  // ADR-BRD-05 — 대상 시설 변경. null이면 지점 전체로 되돌린다(생략과 구분).
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  facilityId?: string | null;
}
