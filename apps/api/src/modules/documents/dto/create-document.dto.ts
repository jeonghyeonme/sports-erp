import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { INPUT_LIMITS } from '../../../common/validation/input-limits';
import { DocumentCategory } from '../../../common/api-response.types';

// D69 — 계약서는 문서가 아니라 계약 회차에서 다룬다(분류 없음).
const CATEGORIES: DocumentCategory[] = ['HR_RECORD', 'MANUAL', 'OTHER'];

// D69 2차(log/206) — 문서 파일은 브라우저가 저장소에 먼저 올리고(업로드 URL은 POST /documents/upload-url, 한도 D57)
// 등록 요청에 그 경로를 싣는다. 서버가 저장소에서 크기·형식을 다시 확인한다.
export class DocumentFileRefDto {
  @IsString()
  @Matches(/^documents\/[0-9a-f-]{36}\.[a-z0-9]+$/, { message: '잘못된 문서 파일 경로입니다.' })
  path!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fileName!: string;
}

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

  // D69 2차 — 새 문서는 올린 파일(file). 둘 중 정확히 하나(서비스가 400 DOCUMENT_FILE_REQUIRED).
  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentFileRefDto)
  file?: DocumentFileRefDto;

  // 옛 방식 — 외부 주소만(시드·이관용, 화면은 더 쓰지 않는다). 화면이 이 값을 링크로 열므로 http(s)만 받는다 —
  // `javascript:` 주소를 저장해 다른 관리자가 누르면 스크립트가 실행되는 XSS를 막는다(secure-coding-checklist 입력-4, log/139).
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Matches(/^https?:\/\//i, { message: 'fileUrl은 http:// 또는 https://로 시작해야 합니다.' })
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(INPUT_LIMITS.DOCUMENT_BYTES)
  fileSize?: number;
}
