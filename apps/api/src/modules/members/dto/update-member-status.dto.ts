import { IsIn } from 'class-validator';

export class UpdateMemberStatusDto {
  @IsIn(['ACTIVE', 'DORMANT', 'WITHDRAWN'])
  status!: 'ACTIVE' | 'DORMANT' | 'WITHDRAWN';
}
