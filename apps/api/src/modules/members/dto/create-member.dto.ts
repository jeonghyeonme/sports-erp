import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

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

  @IsOptional()
  @IsString()
  memo?: string;
}
