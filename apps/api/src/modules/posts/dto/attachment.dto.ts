import { IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

// D57 — 첨부 한도(사용자 결정 2026-10-17): 파일당 10MB, 글당 5개, PDF·이미지·오피스·한글.
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENTS_PER_POST = 5;
export const ALLOWED_TYPES: Record<string, string[]> = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  webp: ['image/webp'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  // 한글(hwp)은 브라우저마다 MIME이 달라 비어 있거나 octet-stream으로 온다.
  hwp: ['application/x-hwp', 'application/haansofthwp', 'application/vnd.hancom.hwp', 'application/octet-stream', ''],
};

// 1단계 — 업로드 URL 요청(파일은 아직 없다).
export class RequestUploadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fileName!: string;

  @IsString()
  @MaxLength(200)
  fileType!: string;

  @IsInt()
  @Min(1)
  @Max(ATTACHMENT_MAX_BYTES)
  fileSize!: number;
}

// 2단계 — 올린 파일을 글에 붙인다. path는 1단계가 돌려준 값이어야 한다.
export class ConfirmAttachmentDto {
  @IsString()
  @Matches(/^posts\/[0-9a-zA-Z-]+\/[0-9a-f-]{36}\.[a-z0-9]+$/, { message: '잘못된 첨부 경로입니다.' })
  path!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fileName!: string;
}
