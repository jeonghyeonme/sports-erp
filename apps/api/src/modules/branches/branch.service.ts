import { Injectable } from '@nestjs/common';
import { Branch } from '@prisma/client';
import { toKstDateString } from '../../common/date/kst-date';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchGate, branchGateFrom } from './branch-gate';

/**
 * 지점(Branch) 조회 — D29. 원천은 DB다. 지점에는 쓰기 API가 없다(계약 상태 변경은 본사의
 * 수동 조치). 계약 종료(TERMINATED) 규칙이 여기 한 곳으로 모인다 — CLAUDE.md가 실DB 전환 이후로 미뤄둔
 * "공통 검사 중앙화"의 첫 조각.
 */
@Injectable()
export class BranchService {
  constructor(private readonly prisma: PrismaService) {}

  /** 아직 mock인 도메인의 쓰기 메서드에 넘길 종료 지점 판정기. 요청마다 한 번 읽는다(종료 지점은 소수). */
  async loadGate(): Promise<BranchGate> {
    const rows = await this.prisma.branch.findMany({
      where: { contractStatus: 'TERMINATED' },
      select: { id: true },
    });
    return branchGateFrom(rows.map((r) => r.id));
  }

  /** SUPER_ADMIN은 전 지점, 그 외는 자기 지점만(지점 데이터 격리). */
  listVisibleTo(user: RequestUser): Promise<Branch[]> {
    if (user.role === 'SUPER_ADMIN') return this.prisma.branch.findMany();
    if (!user.branchId) return Promise.resolve([]);
    return this.prisma.branch.findMany({ where: { id: user.branchId } });
  }

  /**
   * 지점 목록의 건수 — D32로 회원·직원·프로그램이 전부 DB가 되어 mock 집계(branchCounts)를 대신한다.
   * 예전 mock과 같은 정의: 회원·직원은 상태와 무관하게 전부, 프로그램은 RUNNING만.
   */
  async counts(branchIds: string[]): Promise<Map<string, { memberCount: number; staffCount: number; runningProgramCount: number }>> {
    const [members, staff, programs] = await Promise.all([
      this.prisma.member.groupBy({ by: ['branchId'], where: { branchId: { in: branchIds } }, _count: { _all: true } }),
      this.prisma.staff.groupBy({ by: ['branchId'], where: { branchId: { in: branchIds } }, _count: { _all: true } }),
      this.prisma.program.groupBy({
        by: ['branchId'],
        where: { branchId: { in: branchIds }, status: 'RUNNING' },
        _count: { _all: true },
      }),
    ]);
    const of = (rows: Array<{ branchId: string; _count: { _all: number } }>, id: string) =>
      rows.find((r) => r.branchId === id)?._count._all ?? 0;
    return new Map(
      branchIds.map((id) => [
        id,
        { memberCount: of(members, id), staffCount: of(staff, id), runningProgramCount: of(programs, id) },
      ]),
    );
  }

  /** API 응답 형식 — @db.Date 컬럼을 "YYYY-MM-DD"로(이관 전 mock 응답과 같은 형식). */
  static toContractView(branch: Branch) {
    return {
      id: branch.id,
      name: branch.name,
      region: branch.region,
      contractPartner: branch.contractPartner,
      contractStatus: branch.contractStatus,
      contractStartAt: toKstDateString(branch.contractStartAt),
      contractEndAt: branch.contractEndAt ? toKstDateString(branch.contractEndAt) : undefined,
    };
  }
}
