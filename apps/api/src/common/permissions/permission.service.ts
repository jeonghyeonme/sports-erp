import { Injectable } from '@nestjs/common';
import { PermissionAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../interfaces/request-user.interface';
import { permissionKey, withinCeiling } from './permission-catalog';

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
