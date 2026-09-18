import { IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateInstructorDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  // 1-7문서 강사 정산에서 쓰는 수수료율(0~1). 비워두면 정산 대상 아님(본사 직속 등 별도 급여체계).
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate?: number;
}
