import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../exceptions/app.exception';
import { RequestUser } from '../types/request-user.interface';

/**
 * 01문서 §7: "모든 조회 API의 list 파라미터 — branchId 강제 고정(본인 값, 파라미터 무시)".
 *
 * BRANCH_ADMIN/STAFF 요청은 query.branchId / body.branchId를 본인 소속 지점으로 강제합니다.
 * - 파라미터가 없으면 본인 branchId를 채워 넣습니다.
 * - 파라미터가 있는데 본인 소속과 다르면 403(BRANCH_SCOPE_FORBIDDEN)으로 차단합니다(값을 조용히
 *   덮어쓰지 않는 이유: 클라이언트가 명시적으로 다른 지점을 요청했다는 것 자체가 이상 신호이므로).
 * SUPER_ADMIN/MEMBER는 지점 스코프 대상이 아니므로 통과시킵니다.
 *
 * 주의: 이 가드는 "목록 조회/생성"처럼 body·query에 branchId가 실려오는 엔드포인트 전용입니다.
 * `/members/:id`처럼 리소스 id만으로 접근하는 엔드포인트는 이 가드로 걸러지지 않으므로,
 * 서비스 레이어에서 조회한 리소스의 branchId를 반드시 다시 검증해야 합니다(2중 방어, 00문서 §3.3).
 */
@Injectable()
export class BranchScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user: RequestUser;
      query: Record<string, unknown>;
      body: Record<string, unknown>;
    }>();
    const { user } = request;
    if (!user || user.role === 'SUPER_ADMIN' || user.role === 'MEMBER') return true;

    if (!user.branchId) {
      throw new AppException('NO_BRANCH_ASSIGNED', '지점에 소속되지 않은 계정입니다.', HttpStatus.FORBIDDEN);
    }

    for (const bag of [request.query, request.body]) {
      if (bag && typeof bag === 'object' && 'branchId' in bag && bag.branchId != null) {
        if (bag.branchId !== user.branchId) {
          throw new AppException(
            'BRANCH_SCOPE_FORBIDDEN',
            '다른 지점의 데이터에는 접근할 수 없습니다.',
            HttpStatus.FORBIDDEN,
          );
        }
      }
    }
    if (request.query) request.query.branchId = user.branchId;
    if (request.body && typeof request.body === 'object' && !Array.isArray(request.body)) {
      request.body.branchId = user.branchId;
    }
    return true;
  }
}
