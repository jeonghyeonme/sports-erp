import { IsIn } from 'class-validator';

export class UpdateProgramStatusDto {
  @IsIn(['PREPARING', 'RUNNING', 'PAUSED', 'ENDED'])
  status!: 'PREPARING' | 'RUNNING' | 'PAUSED' | 'ENDED';
}
