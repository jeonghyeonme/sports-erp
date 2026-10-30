import { Injectable } from '@nestjs/common';
import { Branch, BranchContractStatus, Prisma } from '@prisma/client';
import { todayKst, toKstDateString } from '../../common/date/kst-date';
import { AppException } from '../../common/exceptions/app.exception';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { recordAudit } from '../../prisma/audit';
import { endAssignmentsAtTerminatedBranch } from '../staff/terminated-branch-assignments';
import { BranchGate, branchGateFrom } from './branch-gate';

// entities.md §2-1 renewalNoticeAt — 종료 60일 전부터 갱신 알림 대상(정책값, D68 결정 4).
const RENEWAL_NOTICE_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const dateOf = (d: string) => new Date(`${d}T00:00:00Z`);

interface ContractRow {
  contractStatus: BranchContractStatus;
  contractPartner: string;
  contractStartAt: Date;
  contractEndAt: Date | null;
}

/**
 * 지점(Branch) 조회 — D29. 원천은 DB다. 쓰기는 본사의 계약 상태 변경(ADR-STF-07)과 계약 갱신·정정(D68)이다.
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
      // D68 결정 3 — 상태 변경도 계약 이력에 남긴다(같은 상태로 다시 지정한 것은 변경이 아니라 남기지 않는다).
      if (before.contractStatus !== status) {
        await recordAudit(tx, {
          actorId: actorAccountId,
          entity: 'Branch',
          entityId: branchId,
          action: 'CONTRACT_STATUS_CHANGED',
          before: { contractStatus: before.contractStatus },
          after: { contractStatus: status },
        });
      }
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

  /**
   * 계약 갱신(SUPER_ADMIN) — D68 결정 1. 새 종료일은 지금 종료일(상시 계약이면 시작일)보다 뒤여야 하고, 상태는 정상으로 돌린다.
   * 종료(TERMINATED) 지점은 끝난 계약이라 409 — 같은 단지와 다시 계약하면 본사가 상태를 먼저 되돌린다.
   */
  async renewContract(
    branchId: string,
    input: { contractEndAt: string; contractPartner?: string },
    actorAccountId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockContract(tx, branchId);
      if (before.contractStatus === 'TERMINATED') {
        throw new AppException(
          'BRANCH_TERMINATED',
          '계약이 종료된 지점은 갱신할 수 없습니다. 같은 단지와 다시 계약했다면 계약 상태를 먼저 되돌려 주세요.',
          409,
        );
      }
      const floor = before.contractEndAt ?? before.contractStartAt;
      if (input.contractEndAt <= toKstDateString(floor)) {
        throw new AppException(
          'INVALID_CONTRACT_PERIOD',
          `새 종료일은 지금 ${before.contractEndAt ? '종료일' : '시작일'}(${toKstDateString(floor)})보다 뒤여야 합니다.`,
          400,
        );
      }
      const partnerChanged = input.contractPartner !== undefined && input.contractPartner !== before.contractPartner;
      const branch = await tx.branch.update({
        where: { id: branchId },
        data: {
          contractEndAt: dateOf(input.contractEndAt),
          contractStatus: 'ACTIVE',
          ...(partnerChanged ? { contractPartner: input.contractPartner } : {}),
        },
      });
      await recordAudit(tx, {
        actorId: actorAccountId,
        entity: 'Branch',
        entityId: branchId,
        action: 'CONTRACT_RENEWED',
        before: {
          contractEndAt: before.contractEndAt ? toKstDateString(before.contractEndAt) : null,
          contractStatus: before.contractStatus,
          ...(partnerChanged ? { contractPartner: before.contractPartner } : {}),
        },
        after: {
          contractEndAt: input.contractEndAt,
          contractStatus: 'ACTIVE',
          ...(partnerChanged ? { contractPartner: input.contractPartner } : {}),
        },
      });
      return BranchService.toContractView(branch);
    });
  }

  /**
   * 계약 정보 정정(SUPER_ADMIN) — D68 결정 2. 오타 수정이라 갱신으로 세지 않고 상태도 바꾸지 않는다.
   * 바뀐 필드만 이력에 남기고, 바뀐 게 없으면 이력도 남기지 않는다. 시작일 ≤ 종료일.
   */
  async correctContract(
    branchId: string,
    input: { contractPartner?: string; contractStartAt?: string; contractEndAt?: string },
    actorAccountId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.lockContract(tx, branchId);
      const current = {
        contractPartner: row.contractPartner,
        contractStartAt: toKstDateString(row.contractStartAt),
        contractEndAt: row.contractEndAt ? toKstDateString(row.contractEndAt) : null,
      };
      const given = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
      const next = { ...current, ...given };
      const fields = (Object.keys(current) as Array<keyof typeof current>).filter((k) => next[k] !== current[k]);
      if (next.contractEndAt && next.contractEndAt < next.contractStartAt) {
        throw new AppException('INVALID_CONTRACT_PERIOD', '계약 종료일이 시작일보다 앞설 수 없습니다.', 400);
      }
      if (fields.length === 0) {
        return BranchService.toContractView(await tx.branch.findUniqueOrThrow({ where: { id: branchId } }));
      }
      const branch = await tx.branch.update({
        where: { id: branchId },
        data: {
          contractPartner: next.contractPartner,
          contractStartAt: dateOf(next.contractStartAt),
          contractEndAt: next.contractEndAt ? dateOf(next.contractEndAt) : null,
        },
      });
      const pick = (v: typeof current) => Object.fromEntries(fields.map((k) => [k, v[k]])) as Prisma.InputJsonObject;
      await recordAudit(tx, {
        actorId: actorAccountId,
        entity: 'Branch',
        entityId: branchId,
        action: 'CONTRACT_CORRECTED',
        before: pick(current),
        after: pick(next),
      });
      return BranchService.toContractView(branch);
    });
  }

  /** 계약 쓰기끼리와 채용·발령의 공유 락(lockBranchForShare)을 직렬화하는 행 배타 락 — changeContractStatus와 같다. */
  private async lockContract(tx: Prisma.TransactionClient, branchId: string): Promise<ContractRow> {
    const [row] = await tx.$queryRaw<ContractRow[]>`
      SELECT "contractStatus", "contractPartner", "contractStartAt", "contractEndAt"
      FROM "Branch" WHERE "id" = ${branchId} FOR UPDATE`;
    if (!row) throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
    return row;
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

  /**
   * API 응답 형식 — @db.Date 컬럼을 "YYYY-MM-DD"로(이관 전 mock 응답과 같은 형식).
   * D68 결정 4 — 남은 일수와 갱신 알림은 스케줄러 없이 조회 때 계산한다. 알림은 상태가 정상인데 종료가 60일 안으로
   * 들어온 경우만(이미 갱신 임박·만료로 바꾼 지점은 본사가 알고 있다). 상태를 자동으로 바꾸지는 않는다.
   */
  static toContractView(branch: Branch) {
    const endAt = branch.contractEndAt ? toKstDateString(branch.contractEndAt) : undefined;
    const daysLeft = endAt === undefined ? undefined : Math.round((dateOf(endAt).getTime() - dateOf(todayKst()).getTime()) / DAY_MS);
    return {
      id: branch.id,
      name: branch.name,
      region: branch.region,
      contractPartner: branch.contractPartner,
      contractStatus: branch.contractStatus,
      contractStartAt: toKstDateString(branch.contractStartAt),
      contractEndAt: endAt,
      contractDaysLeft: daysLeft,
      renewalNotice:
        branch.contractStatus === 'ACTIVE' && daysLeft !== undefined && daysLeft >= 0 && daysLeft <= RENEWAL_NOTICE_DAYS,
    };
  }
}
