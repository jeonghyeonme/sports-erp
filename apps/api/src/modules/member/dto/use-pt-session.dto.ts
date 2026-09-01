import { IsOptional, IsString } from 'class-validator';

export class UsePtSessionDto {
  @IsOptional()
  @IsString()
  note?: string;
}
