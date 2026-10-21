import { Injectable } from '@nestjs/common';
import { PermissionAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../interfaces/request-user.interface';
import { FeatureDef, GOVERNED_ROLES, GovernedRole, PERMISSION_CATALOG, permissionKey, withinCeiling } from './permission-catalog';

// 역할 기본값은 실행 환경마다 30초 캐시한다(D60 결정 5) — 요청마다 왕복을 늘리지 않는 대신, 바꾼 값은 최대 30초 늦게 반영된다.
// 개인 예외는 매 요청 계정 조회(ADR-AUTH-01)에 실려 와서 바로 반영된다.
const ROLE_CACHE_MS = 30_000;

@Injectable()
export class PermissionService {
  private roleCache?: { at: number; map: Map<string, boolean> };

  constructor(private readonly prisma: PrismaService) {}

  /** 역할 기본값을 바꾼 뒤 부른다(같은 실행 환경은 바로 반영). */
  invalidate(): void {
    this.roleCache = undefined;
  }

  async roleDefaults(): Promise<Map<string, boolean>> {
    if (this.roleCache && Date.now() - this.roleCache.at < ROLE_CACHE_MS) return this.roleCache.map;
    const rows = await this.prisma.rolePermission.findMany();
    const map = new Map(rows.map((r) => [`${r.role}|${permissionKey(r.feature, r.action)}`, r.allowed]));
    this.roleCache = { at: Date.now(), map };
    return map;
  }

  /**
   * D60 3단계 — 화면이 메뉴·버튼을 숨기도록 이 사람의 상한 안 칸마다 적용 값(`feature:ACTION` → 허용).
   * 본사·회원은 표 밖이라 undefined(화면은 역할로만 판단). 판정 자체는 여전히 가드가 한다.
   */
  async effective(user: RequestUser): Promise<Record<string, boolean> | undefined> {
    if (!GOVERNED_ROLES.includes(user.role as GovernedRole)) return undefined;
    const role = user.role as GovernedRole;
    const defaults = await this.roleDefaults();
    const out: Record<string, boolean> = {};
    for (const [feature, def] of Object.entries(PERMISSION_CATALOG as Record<string, FeatureDef>)) {
      for (const action of def.ceiling[role] ?? []) {
        const key = permissionKey(feature, action);
        out[key] = user.permissions?.[key] ?? defaults.get(`${role}|${key}`) ?? true;
      }
    }
    return out;
  }

  /**
   * 판정: 상한 밖이면 표가 다루지 않는 칸 → true(역할 상한은 RolesGuard가 이미 봤다).
   * 상한 안이면 개인 예외 → 역할 기본값 → 허용 순.
   */
  async allows(user: RequestUser, feature: string, action: PermissionAction): Promise<boolean> {
    if (!withinCeiling(user.role, feature, action)) return true;
    const key = permissionKey(feature, action);
    const personal = user.permissions?.[key];
    if (personal !== undefined) return personal;
    return (await this.roleDefaults()).get(`${user.role}|${key}`) ?? true;
  }
}
