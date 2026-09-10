import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { RequestUser } from '../interfaces/request-user.interface';
import { AppException } from '../exceptions/app.exception';

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
      // ForbiddenException(HttpException 일반)에 code를 실어도 AllExceptionsFilter가 그대로
      // 통과시키지 않고 HTTP status 이름(FORBIDDEN)으로 덮어쓰므로, 커스텀 code가 필요하면
      // AppException을 써야 한다(2026-09-10 Write API 작업 중 curl로 실측 확인).
      throw new AppException(
        'BRANCH_SCOPE_VIOLATION',
        '다른 지점의 데이터에는 접근할 수 없습니다.',
        403,
      );
    }

    request.query.branchId = user.branchId;
    return true;
  }
}
