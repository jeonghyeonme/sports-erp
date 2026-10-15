import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

const STATUSES: AttendanceStatus[] = ['NORMAL', 'LATE', 'EARLY_LEAVE', 'ABSENT', 'ON_LEAVE'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// ADR-ATT-04(domains/근태관리.md) — PUT /attendance/:staffId/:date 바디. 그날 근태를 이 값으로 바꾼다(없으면 만든다).
// 시각은 그 날짜의 KST "HH:mm". 사유는 필수(근태관리 A-7 "정정 사유 필수 입력").
export class CorrectAttendanceDto {
  @IsIn(STATUSES)
  status!: AttendanceStatus;

  @IsOptional()
  @Matches(HHMM, { message: 'checkInTime은 HH:mm 형식이어야 합니다.' })
  checkInTime?: string;

  @IsOptional()
  @Matches(HHMM, { message: 'checkOutTime은 HH:mm 형식이어야 합니다.' })
  checkOutTime?: string;

  @IsString()
  @MinLength(2, { message: '정정 사유를 2자 이상 입력하세요.' })
  @MaxLength(200)
  reason!: string;
}
