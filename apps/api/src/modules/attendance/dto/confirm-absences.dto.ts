import { IsOptional, IsString, Matches } from 'class-validator';

// ADR-ATT-02(domains/근태관리.md) — POST /attendance/absence-confirm 바디.
export class ConfirmAbsencesDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month는 YYYY-MM 형식이어야 합니다.' })
  month!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
