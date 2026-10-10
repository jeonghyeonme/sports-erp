import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestUser } from '../interfaces/request-user.interface';
import { AppException } from '../exceptions/app.exception';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SCOPED_RESOURCE_KEY, ScopedResourceMeta } from '../decorators/scoped-resource.decorator';
import { SCOPED_KINDS, ScopeOwner, ScopeOwners } from './scope-owners';

/**
 * architecture/system-overview.md §3.3의 BranchScopeGuard. D46부터 AppModule에 APP_GUARD로 전역 등록한다
 * (JwtAuthGuard → RolesGuard 다음). 지점 격리 검사가 여기 한 곳에 모인다.
 *
 * 1. branchId 파라미터·쿼리 — SUPER_ADMIN 외에는 본인 소속으로 강제. 다른 지점을 지정하면 403,
 *    지정하지 않았으면 서비스가 필터링하도록 req.query.branchId에 주입한다(가드 + 서비스 이중 적용).
 * 2. @ScopedResource(kind) — 라우트가 다루는 리소스의 주인을 읽어 없으면 404, 남의 것이면 403.
 *    SUPER_ADMIN 전체 / MEMBER는 회원·예약을 본인 것만 / STAFF는 직원·휴가를 본인 것만 / 그 밖은 소유 지점 일치.
 *    전사 문서(branchId null)는 모든 지점에 공개.
 *
 * 컨트롤러에 남는 것은 지점이 아닌 규칙(작성자 본인, 필드별 권한 등)뿐이다.
 */
@Injectable()
export class BranchScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly owners: ScopeOwners,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ADR-MEM-01 — @Public() 라우트(/members/link 등)는 인증 자체가 없어 user가 없다.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user: RequestUser | undefined = request.user;
    if (!user) return false;

    this.enforceBranchParam(request, user);

    const scoped = this.reflector.get<ScopedResourceMeta | undefined>(SCOPED_RESOURCE_KEY, context.getHandler());
    if (scoped) await this.enforceResource(scoped, request, user);
    return true;
  }

  private enforceBranchParam(
    request: { params?: Record<string, string>; query: Record<string, unknown> },
    user: RequestUser,
  ): void {
    if (user.role === 'SUPER_ADMIN') return;
    const requested = request.params?.branchId ?? request.query?.branchId;
    if (requested && requested !== user.branchId) {
      // ForbiddenException(HttpException 일반)에 code를 실어도 AllExceptionsFilter가 HTTP status 이름(FORBIDDEN)으로
      // 덮어쓰므로, 커스텀 code가 필요하면 AppException을 써야 한다(2026-09-10 Write API 작업 중 curl로 실측 확인).
      throw new AppException('BRANCH_SCOPE_VIOLATION', '다른 지점의 데이터에는 접근할 수 없습니다.', 403);
    }
    request.query.branchId = user.branchId;
  }

  private async enforceResource(
    scoped: ScopedResourceMeta,
    request: { params?: Record<string, unknown>; query?: Record<string, unknown>; body?: Record<string, unknown> },
    user: RequestUser,
  ): Promise<void> {
    if (scoped.skipFor?.includes(user.role)) return;
    const raw = request[scoped.source === 'param' ? 'params' : scoped.source]?.[scoped.key];
    if (typeof raw !== 'string' || raw === '') return; // 쿼리·본문 생략 = 핸들러의 "본인" 기본값

    const info = SCOPED_KINDS[scoped.kind];
    const owner = await this.owners.find(scoped.kind, raw);
    if (!owner) throw new AppException(info.notFound[0], info.notFound[1], 404);

    const verdict = judge(user, owner, info.shared === true);
    if (verdict === 'ok') return;
    throw new AppException(
      scoped.code ?? info.violation,
      verdict === 'not-self'
        ? `본인 ${info.label}만 다룰 수 있습니다.`
        : `다른 지점의 ${info.label}에는 접근할 수 없습니다.`,
      403,
    );
  }
}

function judge(user: RequestUser, owner: ScopeOwner, shared: boolean): 'ok' | 'not-self' | 'other-branch' {
  if (user.role === 'SUPER_ADMIN') return 'ok';
  if (user.role === 'MEMBER' && owner.memberId !== undefined) {
    return owner.memberId === user.memberId ? 'ok' : 'not-self';
  }
  if (user.role === 'STAFF' && owner.staffId !== undefined) {
    return owner.staffId === user.staffId ? 'ok' : 'not-self';
  }
  if (owner.branchId === null) return shared ? 'ok' : 'other-branch';
  return user.branchId && owner.branchId === user.branchId ? 'ok' : 'other-branch';
}
