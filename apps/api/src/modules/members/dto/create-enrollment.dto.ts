import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEnrollmentDto {
  @IsString()
  @MinLength(1)
  programId!: string;

  @IsDateString()
  enrolledAt!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
