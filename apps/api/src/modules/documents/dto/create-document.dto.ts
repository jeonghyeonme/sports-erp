import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, MinLength } from 'class-validator';
import { INPUT_LIMITS } from '../../../common/validation/input-limits';
import { DocumentCategory } from '../../../fixtures/mock-data.types';

// D69 — 계약서는 문서가 아니라 계약 회차에서 다룬다(분류 없음).
const CATEGORIES: DocumentCategory[] = ['HR_RECORD', 'MANUAL', 'OTHER'];

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

  // 실제 업로드 인프라가 없어 URL/경로 문자열만 받는다. 화면이 이 값을 링크(href)로 그리므로 http(s)만 받는다 —
  // `javascript:` 주소를 저장해 다른 관리자가 누르면 스크립트가 실행되는 XSS를 막는다(secure-coding-checklist 입력-4, log/139).
  @IsString()
  @MinLength(1)
  @Matches(/^https?:\/\//i, { message: 'fileUrl은 http:// 또는 https://로 시작해야 합니다.' })
  fileUrl!: string;

  @IsOptional()
  @IsString()
  fileType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(INPUT_LIMITS.DOCUMENT_BYTES)
  fileSize?: number;
}
