import { IsDateString, IsInt, IsString, Max, Min, MinLength } from 'class-validator';
import { INPUT_LIMITS } from '../../../common/validation/input-limits';

export class CreatePTSessionDto {
  @IsString()
  @MinLength(1)
  programId!: string;

  // 정원과 마찬가지로 추측하면 안 되는 값 — 구매한 세션 수만큼 정확히 입력받는다.
  @IsInt()
  @Min(1)
  @Max(INPUT_LIMITS.PT_SESSIONS)
  totalSessions!: number;

  @IsDateString()
  purchasedAt!: string;
}
