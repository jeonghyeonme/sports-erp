import { IsOptional, IsString, MinLength } from 'class-validator';

// PATCH /staff/:id — branchId는 여기서 바꿀 수 없다(파견 발령 API 전용, 02문서 §5).
export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  employmentType?: string;
}
