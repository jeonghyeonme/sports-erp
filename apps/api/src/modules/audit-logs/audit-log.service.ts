import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditLogView {
  id: string;
  createdAt: string;
  actorId?: string;
  actorName?: string;
  entity: string;
  entityId: string;
  // entity=Staff면 대상 직원 이름(삭제된 대상이면 비어 있다)
  entityName?: string;
  action: string;
  before?: Prisma.JsonValue;
  after?: Prisma.JsonValue;
}

/** D44 — 변경 이력 조회(본사 전용). 쓰기는 각 도메인이 같은 트랜잭션에서 `recordAudit`로 한다. */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: {
    entity?: string;
    entityId?: string;
    action?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: AuditLogView[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {
      entity: filter.entity || undefined,
      entityId: filter.entityId || undefined,
      action: filter.action || undefined,
    };
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { name: true } } },
        // 최신순. id는 같은 시각의 동점 정렬용(페이지 경계가 흔들리지 않게).
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);
    // 대상 이름은 쪽 단위로 한 번에 모은다(행마다 조회하지 않는다). 지금 entity는 Staff뿐이다.
    const staffIds = [...new Set(rows.filter((r) => r.entity === 'Staff').map((r) => r.entityId))];
    const staff = staffIds.length
      ? await this.prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } })
      : [];
    const staffName = new Map(staff.map((s) => [s.id, s.name]));
    const items = rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      actorId: r.actorId ?? undefined,
      actorName: r.actor?.name,
      entity: r.entity,
      entityId: r.entityId,
      entityName: r.entity === 'Staff' ? staffName.get(r.entityId) : undefined,
      action: r.action,
      before: r.before ?? undefined,
      after: r.after ?? undefined,
    }));
    return { items, total };
  }
}
