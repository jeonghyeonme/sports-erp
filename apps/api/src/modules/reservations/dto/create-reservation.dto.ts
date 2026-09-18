import { IsString, MinLength } from 'class-validator';

export class CreateReservationDto {
  @IsString()
  @MinLength(1)
  scheduleSlotId!: string;
}
