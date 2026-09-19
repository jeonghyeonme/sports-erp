import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { AssetCategory, AssetType } from '../../../mock-data/mock-data.types';

const CATEGORIES: AssetCategory[] = ['EXERCISE_EQUIPMENT', 'SAFETY_EQUIPMENT', 'OFFICE_FURNITURE', 'OTHER'];
const TYPES: AssetType[] = ['FIXED_ASSET', 'CONSUMABLE'];

export class CreateAssetDto {
  // SUPER_ADMIN만 지정 가능 — BRANCH_ADMIN은 서버가 본인 지점으로 강제한다.
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(CATEGORIES)
  category!: AssetCategory;

  @IsDateString()
  acquiredAt!: string;

  @IsInt()
  @Min(0)
  acquisitionCost!: number;

  // 비우면 취득가액 100만원 기준으로 자동 판정한다.
  @IsOptional()
  @IsIn(TYPES)
  assetType?: AssetType;

  @IsOptional()
  @IsInt()
  @Min(1)
  usefulLifeYears?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
