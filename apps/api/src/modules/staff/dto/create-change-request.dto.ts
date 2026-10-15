import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

// ADR-STF-09 — 직원이 신청할 수 있는 항목은 이름·연락처뿐이다(사용자 결정 2026-10-15). 직급·고용형태·휴무는 관리자가 직접 정한다.
export const CHANGEABLE_FIELDS = ['name', 'phone'] as const;
export type ChangeableField = (typeof CHANGEABLE_FIELDS)[number];

export class CreateChangeRequestDto {
  @IsIn(CHANGEABLE_FIELDS)
  field!: ChangeableField;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  newValue!: string; // 연락처 형식은 서비스가 본다(항목에 따라 규칙이 달라서)
}
