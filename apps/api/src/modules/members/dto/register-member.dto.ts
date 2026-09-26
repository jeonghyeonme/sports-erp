import { IsBoolean, IsDateString, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

// ADR-MEM-02 — 앱 회원가입. Account+Member를 동시에 만든다.
export class RegisterMemberDto {
  @IsString()
  @MinLength(1)
  branchId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  // 05문서 §3, §6 — 만 19세 미만 회원 등록 시 필수(미전달/false면 400).
  @IsOptional()
  @IsBoolean()
  guardianConsent?: boolean;
}
