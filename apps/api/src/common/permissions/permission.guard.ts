import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../exceptions/app.exception';
import { RequestUser } from '../interfaces/request-user.interface';
import { ACTION_LABEL, PERMISSION_CATALOG, FeatureDef } from './permission-catalog';
import { PERMISSION_KEY, PermissionMeta } from './permission.decorator';
import { PermissionService } from './permission.service';

/**
 * D60 — 세부 권한 판정. RolesGuard(역할 상한)·BranchScopeGuard(지점 격리) 다음에 돈다.
 * 개인 예외로 "허용"해도 상한·격리를 넘지 못한다 — 둘은 이 가드보다 먼저 거부한다.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.get<PermissionMeta | undefined>(PERMISSION_KEY, context.getHandler());
    if (!meta) return true; // 선언 누락은 permission-coverage spec이 잡는다
    const request = context.switchToHttp().getRequest<{ user?: RequestUser; query?: Record<string, unknown> }>();
    const user = request.user;
    if (!user || (user.role !== 'BRANCH_ADMIN' && user.role !== 'STAFF')) return true;

    const actions = [meta.action];
    if (meta.exportable && request.query?.export === 'true') actions.push('EXPORT');
    for (const action of actions) {
      if (!(await this.permissions.allows(user, meta.feature, action))) {
        const label = (PERMISSION_CATALOG as Record<string, FeatureDef>)[meta.feature].label;
        throw new AppException('PERMISSION_DENIED', `${label} ${ACTION_LABEL[action]} 권한이 없습니다. 본사에 문의하세요.`, 403);
      }
    }
    return true;
  }
}
