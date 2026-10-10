import { Injectable } from '@nestjs/common';
import { Branch, BranchContractStatus } from '@prisma/client';
import { todayKst, toKstDateString } from '../../common/date/kst-date';
import { AppException } from '../../common/exceptions/app.exception';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { endAssignmentsAtTerminatedBranch } from '../staff/terminated-branch-assignments';
import { BranchGate, branchGateFrom } from './branch-gate';

/**
 * 지점(Branch) 조회 — D29. 원천은 DB다. 쓰기는 본사의 계약 상태 변경 하나뿐이다(ADR-STF-07).
 * 계약 종료(TERMINATED) 규칙이 여기 한 곳으로 모인다 — CLAUDE.md가 실DB 전환 이후로 미뤄둔
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

  /**
   * 계약 상태 변경(SUPER_ADMIN) — ADR-STF-07. TERMINATED로 **바뀔 때** 그 지점의 진행 중 파견을 같은 트랜잭션에서
   * 종료하고(담당 회원·강사 연결도 해제), 재배치 대상 직원과 담당이 풀린 회원을 응답으로 돌려준다.
   * EXPIRED·RENEWAL_DUE·ACTIVE로의 변경과 이미 TERMINATED인 지점의 재지정은 파견을 건드리지 않는다.
   * 지점 행을 FOR UPDATE로 먼저 잠가, 공유 락으로 읽는 채용·발령(lockBranchForShare)과 직렬화한다.
   * TERMINATED에서 되돌려도 끝난 파견은 복구하지 않는다(본사가 다시 발령한다).
   */
  async changeContractStatus(branchId: string, status: BranchContractStatus, actorAccountId: string) {
    const today = todayKst();
    return this.prisma.$transaction(async (tx) => {
      // 행 배타 락 — 동시 상태 변경끼리도 직렬화해 "TERMINATED로 바뀌는 순간"을 정확히 한 번만 판정한다.
      const [before] = await tx.$queryRaw<Array<{ contractStatus: BranchContractStatus }>>`
        SELECT "contractStatus" FROM "Branch" WHERE "id" = ${branchId} FOR UPDATE`;
      if (!before) throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
      const branch = await tx.branch.update({ where: { id: branchId }, data: { contractStatus: status } });
      const terminating = status === 'TERMINATED' && before.contractStatus !== 'TERMINATED';
      const ended = terminating
        ? await endAssignmentsAtTerminatedBranch(tx, branchId, actorAccountId, today)
        : { endedStaff: [], unassignedMembers: [] };
      return {
        ...BranchService.toContractView(branch),
        previousStatus: before.contractStatus,
        // 재배치 대상 — 파견이 끝나 활성 파견이 없는 직원(entities.md §2-1)
        reassignmentTargets: ended.endedStaff,
        unassignedMembers: ended.unassignedMembers,
      };
    });
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
