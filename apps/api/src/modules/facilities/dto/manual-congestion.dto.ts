import { IsInt, Min } from 'class-validator';

export class ManualCongestionDto {
  @IsInt()
  @Min(0)
  currentCount!: number;
}
