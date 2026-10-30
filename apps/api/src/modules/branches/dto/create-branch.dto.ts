import { IsDateString, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// D68 결정 5 — 새 위탁계약 = 새 지점. 시설·프로그램·직원 파견은 기존 화면에서 이어서 한다.
export class CreateBranchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  // 회원번호(코드+연도-순번)·직원코드(코드-순번)의 앞부분이라 영문 대문자만 — 숫자가 섞이면 회원번호의 연도와 붙어 읽힌다.
  @Matches(/^[A-Z]{2,12}$/, { message: '지점 코드는 영문 대문자 2~12자입니다.' })
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  region!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @Matches(/^[0-9-]{7,20}$/, { message: '전화번호는 숫자와 -만 씁니다.' })
  phone?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: '출근 기준 시각은 HH:mm 형식입니다.' })
  standardCheckInTime?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  contractPartner!: string;

  @Matches(DATE_ONLY, { message: '날짜는 YYYY-MM-DD 형식입니다.' })
  @IsDateString({ strict: true })
  contractStartAt!: string;

  @IsOptional()
  @Matches(DATE_ONLY, { message: '날짜는 YYYY-MM-DD 형식입니다.' })
  @IsDateString({ strict: true })
  contractEndAt?: string;
}
