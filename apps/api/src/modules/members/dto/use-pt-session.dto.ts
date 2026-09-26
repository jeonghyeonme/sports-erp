import { IsOptional, IsString } from 'class-validator';

export class UsePTSessionDto {
  @IsOptional()
  @IsString()
  note?: string;
}
