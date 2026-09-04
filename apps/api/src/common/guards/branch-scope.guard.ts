import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { RequestUser } from '../interfaces/request-user.interface';

/**
 * 01문서 §3.3의 BranchScopeGuard.
 * - SUPER_ADMIN: 제한 없음(원하는 branchId를 쿼리/파라미터로 자유롭게 지정 가능)
 * - BRANCH_ADMIN / STAFF / MEMBER: branchId를 항상 본인 소속으로 강제한다.
 *   클라이언트가 다른 지점의 branchId를 파라미터/쿼리로 직접 지정하면 403.
 *   지정하지 않았다면 서비스 레이어가 필터링할 수 있도록 req.query.branchId에 주입한다
 *   (가드 + 서비스 레이어 이중 적용 — 01문서 §3.3의 "가드 우회 방지용 2중 안전장치").
 */
@Injectable()
export class BranchScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: RequestUser | undefined = request.user;
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;

    const requestedBranchId: string | undefined =
      request.params?.branchId ?? request.query?.branchId;

    if (requestedBranchId && requestedBranchId !== user.branchId) {
      throw new ForbiddenException({
        code: 'BRANCH_SCOPE_VIOLATION',
        message: '다른 지점의 데이터에는 접근할 수 없습니다.',
      });
    }

    request.query.branchId = user.branchId;
    return true;
  }
}
