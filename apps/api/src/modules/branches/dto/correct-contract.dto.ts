import { IsDateString, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// D68 결정 2 — 오타 정정. 보낸 필드만 바꾼다(상태는 건드리지 않는다).
export class CorrectContractDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  contractPartner?: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: '날짜는 YYYY-MM-DD 형식입니다.' })
  @IsDateString({ strict: true })
  contractStartAt?: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: '날짜는 YYYY-MM-DD 형식입니다.' })
  @IsDateString({ strict: true })
  contractEndAt?: string;
}
