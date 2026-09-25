import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { DocumentCategory } from '../../../mock-data/mock-data.types';

const CATEGORIES: DocumentCategory[] = ['CONTRACT', 'HR_RECORD', 'MANUAL', 'OTHER'];

export class CreateDocumentDto {
  @IsIn(CATEGORIES)
  category!: DocumentCategory;

  // SUPER_ADMIN만 지정 가능(비우면 전사 문서) — BRANCH_ADMIN은 서버가 본인 지점으로 강제한다.
  @IsOptional()
  @IsString()
  branchId?: string;

  // category=HR_RECORD일 때 필수.
  @IsOptional()
  @IsString()
  relatedStaffId?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  // 실제 업로드 인프라가 없어 URL/경로 문자열만 받는다.
  @IsString()
  @MinLength(1)
  fileUrl!: string;

  @IsOptional()
  @IsString()
  fileType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  // category=CONTRACT일 때 필수(직접 입력, 미입력 시 서비스 계층이 400으로 거부 — ADR-RES-03).
  // 다른 카테고리는 서버가 자동 계산하거나 영구 보관이라 이 필드를 무시한다.
  @IsOptional()
  @IsDateString()
  retentionUntil?: string;
}
