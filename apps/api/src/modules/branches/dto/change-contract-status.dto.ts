import { BranchContractStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeContractStatusDto {
  @IsEnum(BranchContractStatus)
  status!: BranchContractStatus;
}
