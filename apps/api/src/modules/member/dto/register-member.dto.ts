import { IsDateString, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

/** POST /members/register — 공개(앱 회원가입), Account+Member 동시 생성 */
export class RegisterMemberDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  branchId!: string;

  @IsString()
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
}
