import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { searchTerm } from '../../common/http/pagination';

export interface AuditLogView {
  id: string;
  createdAt: string;
  actorId?: string;
  actorName?: string;
  entity: string;
  entityId: string;
  // 대상 직원·회원 이름(삭제된 대상이면 비어 있다)
  entityName?: string;
  action: string;
  before?: Prisma.JsonValue;
  after?: Prisma.JsonValue;
}

/** D44 — 변경 이력 조회(본사 전용). 쓰기는 각 도메인이 같은 트랜잭션에서 `recordAudit`로 한다. */
// D74 2차(log/204) — 대상마다 찾을 수 있는 id 수 상한. 이름이 넓게 맞으면(한 글자 등) 앞에서 자른다.
const SEARCH_ID_CAP = 500;

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * D74 2차(log/204) — 처리자 이름 또는 대상 이름(직원·회원·자산 이름·코드·지점)으로 찾는다.
   * 대상은 entity마다 다른 표라 먼저 맞는 id를 모아 entityId로 거른다(대상 이름을 이력 행에 복사하지 않는다 — D44).
   */
  private async searchWhere(q: string | undefined): Promise<Prisma.AuditLogWhereInput[] | undefined> {
    if (!q) return undefined;
    const has = { contains: q, mode: 'insensitive' as const };
    const take = SEARCH_ID_CAP;
    const [staff, members, assets, branches, documents] = await Promise.all([
      this.prisma.staff.findMany({ where: { name: has }, select: { id: true }, take }),
      this.prisma.member.findMany({ where: { OR: [{ name: has }, { memberNo: has }] }, select: { id: true }, take }),
      this.prisma.asset.findMany({ where: { OR: [{ name: has }, { assetCode: has }] }, select: { id: true }, take }),
      this.prisma.branch.findMany({ where: { name: has }, select: { id: true }, take }),
      this.prisma.document.findMany({ where: { title: has }, select: { id: true }, take }),
    ]);
    const target = (entity: string, rows: { id: string }[]) =>
      rows.length ? [{ entity, entityId: { in: rows.map((r) => r.id) } }] : [];
    return [
      { actor: { name: has } },
      ...target('Staff', staff),
      ...target('Member', members),
      ...target('Asset', assets),
      ...target('Branch', branches),
      ...target('Document', documents),
    ];
  }

  async list(filter: {
    entity?: string;
    entityId?: string;
    action?: string;
    q?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: AuditLogView[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {
      entity: filter.entity || undefined,
      entityId: filter.entityId || undefined,
      action: filter.action || undefined,
      OR: await this.searchWhere(searchTerm(filter.q)),
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
    // 대상 이름은 쪽 단위로 한 번에 모은다(행마다 조회하지 않는다). entity는 Staff·Member(D47 열람 기록)·Asset(D52)·Branch(D68)·Document(D69 2차 열람 기록).
    const idsOf = (entity: string) => [...new Set(rows.filter((r) => r.entity === entity).map((r) => r.entityId))];
    const staffIds = idsOf('Staff');
    const memberIds = idsOf('Member');
    const assetIds = idsOf('Asset');
    const branchIds = idsOf('Branch');
    const documentIds = idsOf('Document');
    const [staff, members, assets, branches, documents] = await Promise.all([
      staffIds.length
        ? this.prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } })
        : [],
      memberIds.length
        ? this.prisma.member.findMany({ where: { id: { in: memberIds } }, select: { id: true, name: true } })
        : [],
      assetIds.length
        ? this.prisma.asset.findMany({ where: { id: { in: assetIds } }, select: { id: true, name: true, assetCode: true } })
        : [],
      branchIds.length
        ? this.prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } })
        : [],
      // 지운(소프트 삭제) 문서도 열람 기록의 대상 이름은 보인다.
      documentIds.length
        ? this.prisma.document.findMany({ where: { id: { in: documentIds } }, select: { id: true, title: true } })
        : [],
    ]);
    const names = new Map<string, string>([
      ...staff.map((x) => [`Staff:${x.id}`, x.name] as const),
      ...members.map((x) => [`Member:${x.id}`, x.name] as const),
      ...assets.map((x) => [`Asset:${x.id}`, `${x.name}(${x.assetCode})`] as const),
      ...branches.map((x) => [`Branch:${x.id}`, x.name] as const),
      ...documents.map((x) => [`Document:${x.id}`, `문서 ${x.title}`] as const),
      // D60 — 역할 기본값 변경은 대상이 역할이다.
      ['Role:BRANCH_ADMIN', '지점 관리자(역할)'] as const,
      ['Role:STAFF', '직원(역할)'] as const,
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      actorId: r.actorId ?? undefined,
      actorName: r.actor?.name,
      entity: r.entity,
      entityId: r.entityId,
      entityName: names.get(`${r.entity}:${r.entityId}`),
      action: r.action,
      before: r.before ?? undefined,
      after: r.after ?? undefined,
    }));
    return { items, total };
  }
}
