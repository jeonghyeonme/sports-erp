import { IsDateString, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// D68 결정 1 — 갱신은 새 종료일이 필수, 상대방은 바뀔 때만.
export class RenewContractDto {
  @Matches(DATE_ONLY, { message: '날짜는 YYYY-MM-DD 형식입니다.' })
  @IsDateString({ strict: true })
  contractEndAt!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  contractPartner?: string;
}
