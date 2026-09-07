import { SetMetadata } from '@nestjs/common';
import { Role } from '../../mock-data/mock-data.types';

export const ROLES_KEY = 'roles';

// 사용 예: @Roles('SUPER_ADMIN', 'BRANCH_ADMIN') — 00문서 §3.3
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
