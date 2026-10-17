import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { SupportRequestStatus } from '@prisma/client';

// D56 — PATCH /support-requests/:id/status(본사). 반려는 답변 필수(서비스·DB CHECK).
export class UpdateSupportStatusDto {
  @IsIn(['IN_PROGRESS', 'DONE', 'REJECTED'])
  status!: Exclude<SupportRequestStatus, 'REQUESTED'>;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  response?: string;
}
