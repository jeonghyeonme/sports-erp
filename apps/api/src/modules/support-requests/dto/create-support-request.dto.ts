import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { SupportRequestCategory } from '@prisma/client';

export const SUPPORT_CATEGORIES: SupportRequestCategory[] = ['FACILITY', 'STAFFING', 'SUPPLIES', 'IT', 'OTHER'];

// D56 — POST /support-requests(지점 관리자). 지점은 요청자 소속으로 서버가 정한다.
export class CreateSupportRequestDto {
  @IsIn(SUPPORT_CATEGORIES)
  category!: SupportRequestCategory;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  content!: string;
}
