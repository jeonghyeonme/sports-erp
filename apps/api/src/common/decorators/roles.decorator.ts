import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** 이 엔드포인트에 접근 가능한 Role 목록을 지정합니다. 지정하지 않으면 RolesGuard는 통과시킵니다. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
