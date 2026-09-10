import { IsOptional, IsString, MinLength } from 'class-validator';

export class AssignStaffDto {
  @IsString()
  @MinLength(1)
  branchId!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
