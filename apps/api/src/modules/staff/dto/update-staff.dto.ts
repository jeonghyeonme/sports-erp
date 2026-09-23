import { IsInt, IsOptional, IsString, Max, MinLength, Min } from 'class-validator';

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

  // ATT-T05 — 정기 휴무 요일(0=일~6=토).
  @IsOptional()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  offDays?: number[];
}
