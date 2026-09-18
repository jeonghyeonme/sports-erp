import { IsDateString, IsString, MinLength } from 'class-validator';

export class CreateWorkLogDto {
  @IsDateString()
  date!: string;

  @IsString()
  @MinLength(1)
  content!: string;
}
