import { IsInt, Max, Min } from 'class-validator';
import { INPUT_LIMITS } from '../../../common/validation/input-limits';

export class ManualCongestionDto {
  @IsInt()
  @Min(0)
  @Max(INPUT_LIMITS.HEADCOUNT)
  currentCount!: number;
}
