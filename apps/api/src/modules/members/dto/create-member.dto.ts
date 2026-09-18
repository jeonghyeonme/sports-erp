import { IsBoolean, IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMemberDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  assignedStaffId?: string;

  // 05문서 §3, §6 — 만 19세 미만 회원 등록 시 필수(미전달/false면 400).
  @IsOptional()
  @IsBoolean()
  guardianConsent?: boolean;

  @IsOptional()
  @IsString()
  memo?: string;
}
