import { IsDateString, IsEmail, IsInt, IsOptional, IsString, Max, MinLength, Min } from 'class-validator';

export class CreateStaffDto {
  @IsString()
  @MinLength(1)
  branchId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsDateString()
  hireDate?: string;

  // ATT-T05 — 정기 휴무 요일(0=일~6=토). 파트타임은 근태관리 도메인에서 이 필드를 쓰지 않는다.
  @IsOptional()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  offDays?: number[];

  @IsOptional()
  @IsString()
  note?: string;
}
