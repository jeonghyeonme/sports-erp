import { IsIn } from 'class-validator';

export class UpdateStaffRoleDto {
  @IsIn(['STAFF', 'BRANCH_ADMIN'])
  role!: 'STAFF' | 'BRANCH_ADMIN';
}
