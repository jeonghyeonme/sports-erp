import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestUser } from '../interfaces/request-user.interface';

// @Roles() 데코레이터가 없는 라우트는 통과(로그인만 되어 있으면 접근 가능).
// AppModule에 APP_GUARD로 전역 등록 — 00문서 §3.3.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const user: RequestUser | undefined = context.switchToHttp().getRequest().user;
    return !!user && requiredRoles.includes(user.role);
  }
}
