import { IsDateString, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateScheduleSlotDto {
  @IsDateString()
  date!: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'startTime은 HH:mm 형식이어야 합니다.' })
  startTime!: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'endTime은 HH:mm 형식이어야 합니다.' })
  endTime!: string;

  // 비우면 Program.capacity를 그대로 쓴다(06문서 §3 "capacity, ScheduleSlot에서 override 가능").
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}
