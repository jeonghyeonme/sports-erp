import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestUser } from '../types/request-user.interface';
import { AppException } from '../exceptions/app.exception';

/** @Roles(...)가 선언된 엔드포인트에서 req.user.role이 허용 목록에 포함되는지 검사 (00문서 §3.4) */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user: RequestUser }>();
    if (!user || !requiredRoles.includes(user.role)) {
      throw new AppException('FORBIDDEN_ROLE', '이 작업을 수행할 권한이 없습니다.', HttpStatus.FORBIDDEN);
    }
    return true;
  }
}
