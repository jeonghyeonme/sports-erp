import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { LeaveType } from '../../../mock-data/mock-data.types';

const LEAVE_TYPES: LeaveType[] = ['ANNUAL', 'SICK', 'FAMILY_EVENT', 'OTHER'];

export class CreateLeaveRequestDto {
  @IsIn(LEAVE_TYPES)
  type!: LeaveType;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
