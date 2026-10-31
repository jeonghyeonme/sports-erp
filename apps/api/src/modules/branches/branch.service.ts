import { Injectable } from '@nestjs/common';
import { BranchContractStatus, ContractFileKind, ContractRound, Prisma } from '@prisma/client';
import { todayKst, toKstDateString } from '../../common/date/kst-date';
import { AppException } from '../../common/exceptions/app.exception';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { recordAudit } from '../../prisma/audit';
import { endAssignmentsAtTerminatedBranch } from '../staff/terminated-branch-assignments';
import { BranchGate, branchGateFrom } from './branch-gate';
import { ContractFileService } from './contract-file.service';

// entities.md §2-1 renewalNoticeAt — 종료 60일 전부터 갱신 알림 대상(정책값, D68 결정 4).
const RENEWAL_NOTICE_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const dateOf = (d: string) => new Date(`${d}T00:00:00Z`);

// D69 — 지점의 계약 정보 = 가장 최근 회차. 그 회차의 지금 파일(교체되지 않은 것) 종류만 함께 읽는다.
const CURRENT_ROUND = {
  contractRounds: {
    orderBy: { roundNo: 'desc' },
    take: 1,
    include: { files: { where: { replacedAt: null }, select: { kind: true } } },
  },
} satisfies Prisma.BranchInclude;
export type BranchWithRound = Prisma.BranchGetPayload<{ include: typeof CURRENT_ROUND }>;

interface LockedContract {
  contractStatus: BranchContractStatus;
  round: ContractRound;
}

type FileRef = { path: string; fileName: string };

/**
 * 지점(Branch) 조회 — D29. 원천은 DB다. 쓰기는 본사의 계약 상태 변경(ADR-STF-07)과 지점 등록·계약 갱신·정정(D68),
 * 계약 회차와 계약서·해지 합의서(D69)다. 계약 쓰기는 모두 지점 행 배타 락 위에서 하고 이력을 같은 트랜잭션에 남긴다.
 * 계약 종료(TERMINATED) 규칙이 여기 한 곳으로 모인다 — CLAUDE.md가 실DB 전환 이후로 미뤄둔
 * "공통 검사 중앙화"의 첫 조각.
 */
@Injectable()
export class BranchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: ContractFileService,
  ) {}

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
   * D69 결정 5 — 종료 확정은 진행 중 회차에 해지 합의서가 있어야 한다(기간 경과 여부는 보지 않는다 — 중도 해지).
   * 확정한 날을 회차의 해지 확정일로 남기고(보존기한 기산일), 종료에서 되돌리면 지운다.
   */
  async changeContractStatus(branchId: string, status: BranchContractStatus, actorAccountId: string) {
    const today = todayKst();
    return this.prisma.$transaction(async (tx) => {
      // 행 배타 락 — 동시 상태 변경끼리도 직렬화해 "TERMINATED로 바뀌는 순간"을 정확히 한 번만 판정한다.
      const before = await this.lockContract(tx, branchId);
      const terminating = status === 'TERMINATED' && before.contractStatus !== 'TERMINATED';
      const reverting = before.contractStatus === 'TERMINATED' && status !== 'TERMINATED';
      if (terminating) {
        const agreement = await tx.contractFile.count({
          where: { roundId: before.round.id, kind: 'TERMINATION_AGREEMENT', replacedAt: null },
        });
        if (agreement === 0) {
          throw new AppException(
            'TERMINATION_AGREEMENT_REQUIRED',
            '계약 종료를 확정하려면 진행 중인 회차에 해지 합의서를 먼저 올려야 합니다.',
            409,
          );
        }
      }
      if (terminating || reverting) {
        await tx.contractRound.update({
          where: { id: before.round.id },
          data: { terminatedAt: terminating ? dateOf(today) : null },
        });
      }
      await tx.branch.update({ where: { id: branchId }, data: { contractStatus: status } });
      // D68 결정 3 — 상태 변경도 계약 이력에 남긴다(같은 상태로 다시 지정한 것은 변경이 아니라 남기지 않는다).
      if (before.contractStatus !== status) {
        await recordAudit(tx, {
          actorId: actorAccountId,
          entity: 'Branch',
          entityId: branchId,
          action: 'CONTRACT_STATUS_CHANGED',
          before: { contractStatus: before.contractStatus },
          after: { contractStatus: status, roundNo: before.round.roundNo },
        });
      }
      const ended = terminating
        ? await endAssignmentsAtTerminatedBranch(tx, branchId, actorAccountId, today)
        : { endedStaff: [], unassignedMembers: [] };
      return {
        ...(await this.view(tx, branchId)),
        previousStatus: before.contractStatus,
        // 재배치 대상 — 파견이 끝나 활성 파견이 없는 직원(entities.md §2-1)
        reassignmentTargets: ended.endedStaff,
        unassignedMembers: ended.unassignedMembers,
      };
    });
  }

  /**
   * 신규 지점 등록(SUPER_ADMIN) — D68 결정 5. 새 위탁계약 = 새 지점, 상태는 정상으로 시작한다.
   * D69 — 계약은 1회차로 만들고 계약서와 종료일이 필수다(파일은 트랜잭션 밖에서 저장소를 먼저 확인한다).
   * 지점 코드는 유일(중복 409). 채번 시퀀스(CodeSequence)는 첫 채번 때 만들어지므로 여기서 준비하지 않는다.
   * 등록도 계약 이력의 첫 줄로 남긴다(같은 트랜잭션).
   */
  async createBranch(
    input: {
      name: string;
      code: string;
      region: string;
      address?: string;
      phone?: string;
      standardCheckInTime?: string;
      contractPartner: string;
      contractStartAt: string;
      contractEndAt: string;
      contractFile: FileRef;
    },
    actorAccountId: string,
  ) {
    const { contractPartner, contractStartAt, contractEndAt, contractFile, ...branchInput } = input;
    checkPeriod(contractStartAt, contractEndAt);
    const file = await this.files.verify(contractFile);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const branch = await tx.branch.create({ data: { ...branchInput, contractStatus: 'ACTIVE' } });
        const round = await tx.contractRound.create({
          data: {
            branchId: branch.id,
            roundNo: 1,
            partner: contractPartner,
            startAt: dateOf(contractStartAt),
            endAt: dateOf(contractEndAt),
            createdBy: actorAccountId,
          },
        });
        await this.files.attach(tx, round.id, 'CONTRACT', file, actorAccountId);
        await recordAudit(tx, {
          actorId: actorAccountId,
          entity: 'Branch',
          entityId: branch.id,
          action: 'BRANCH_CREATED',
          after: { code: branch.code, roundNo: 1, contractPartner, contractStartAt, contractEndAt },
        });
        return this.view(tx, branch.id);
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppException('BRANCH_CODE_TAKEN', `지점 코드 ${input.code}는 이미 쓰고 있습니다.`, 409);
      }
      throw e;
    }
  }

  /**
   * 계약 갱신(SUPER_ADMIN) — D69 결정 3. 갱신 = 새 회차: 새 계약서가 있어야 하고, 상대방·기간은 계약서를 보고 넣는다.
   * 새 시작일은 지난 회차 시작일보다 뒤, 종료일은 시작일 이후. 상태는 정상으로 돌린다.
   * 종료(TERMINATED) 지점은 끝난 계약이라 409 — 같은 단지와 다시 계약하면 본사가 상태를 먼저 되돌린다(D68 결정 1).
   */
  async renewContract(
    branchId: string,
    input: { contractPartner: string; contractStartAt: string; contractEndAt: string; contractFile: FileRef },
    actorAccountId: string,
  ) {
    checkPeriod(input.contractStartAt, input.contractEndAt);
    const file = await this.files.verify(input.contractFile);
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockContract(tx, branchId);
      if (before.contractStatus === 'TERMINATED') {
        throw new AppException(
          'BRANCH_TERMINATED',
          '계약이 종료된 지점은 갱신할 수 없습니다. 같은 단지와 다시 계약했다면 계약 상태를 먼저 되돌려 주세요.',
          409,
        );
      }
      const prevStart = toKstDateString(before.round.startAt);
      if (input.contractStartAt <= prevStart) {
        throw new AppException(
          'INVALID_CONTRACT_PERIOD',
          `새 회차 시작일은 지난 회차 시작일(${prevStart})보다 뒤여야 합니다.`,
          400,
        );
      }
      const roundNo = before.round.roundNo + 1;
      const round = await tx.contractRound.create({
        data: {
          branchId,
          roundNo,
          partner: input.contractPartner,
          startAt: dateOf(input.contractStartAt),
          endAt: dateOf(input.contractEndAt),
          createdBy: actorAccountId,
        },
      });
      await this.files.attach(tx, round.id, 'CONTRACT', file, actorAccountId);
      await tx.branch.update({ where: { id: branchId }, data: { contractStatus: 'ACTIVE' } });
      await recordAudit(tx, {
        actorId: actorAccountId,
        entity: 'Branch',
        entityId: branchId,
        action: 'CONTRACT_RENEWED',
        before: {
          roundNo: before.round.roundNo,
          contractPartner: before.round.partner,
          contractStartAt: prevStart,
          contractEndAt: toKstDateString(before.round.endAt),
          contractStatus: before.contractStatus,
        },
        after: {
          roundNo,
          contractPartner: input.contractPartner,
          contractStartAt: input.contractStartAt,
          contractEndAt: input.contractEndAt,
          contractStatus: 'ACTIVE',
        },
      });
      return this.view(tx, branchId);
    });
  }

  /**
   * 계약 정보 정정(SUPER_ADMIN) — D68 결정 2, D69 결정 4. 진행 중인 회차의 오타만 고친다(지난 회차는 고치지 못한다).
   * 갱신으로 세지 않고 상태도 바꾸지 않는다. 바뀐 필드만 이력에 남기고, 바뀐 게 없으면 이력도 남기지 않는다.
   * 시작일 ≤ 종료일, 2회차부터는 시작일이 지난 회차 시작일보다 뒤.
   */
  async correctContract(
    branchId: string,
    input: { contractPartner?: string; contractStartAt?: string; contractEndAt?: string },
    actorAccountId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const { round } = await this.lockContract(tx, branchId);
      const current = {
        contractPartner: round.partner,
        contractStartAt: toKstDateString(round.startAt),
        contractEndAt: toKstDateString(round.endAt),
      };
      const given = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
      const next = { ...current, ...given };
      const fields = (Object.keys(current) as Array<keyof typeof current>).filter((k) => next[k] !== current[k]);
      checkPeriod(next.contractStartAt, next.contractEndAt);
      if (round.roundNo > 1 && fields.includes('contractStartAt')) {
        const prev = await tx.contractRound.findUniqueOrThrow({
          where: { branchId_roundNo: { branchId, roundNo: round.roundNo - 1 } },
        });
        const prevStart = toKstDateString(prev.startAt);
        if (next.contractStartAt <= prevStart) {
          throw new AppException('INVALID_CONTRACT_PERIOD', `시작일은 지난 회차 시작일(${prevStart})보다 뒤여야 합니다.`, 400);
        }
      }
      if (fields.length === 0) return this.view(tx, branchId);
      await tx.contractRound.update({
        where: { id: round.id },
        data: { partner: next.contractPartner, startAt: dateOf(next.contractStartAt), endAt: dateOf(next.contractEndAt) },
      });
      const pick = (v: typeof current) =>
        ({ roundNo: round.roundNo, ...Object.fromEntries(fields.map((k) => [k, v[k]])) }) as Prisma.InputJsonObject;
      await recordAudit(tx, {
        actorId: actorAccountId,
        entity: 'Branch',
        entityId: branchId,
        action: 'CONTRACT_CORRECTED',
        before: pick(current),
        after: pick(next),
      });
      return this.view(tx, branchId);
    });
  }

  /**
   * 진행 중인 회차에 계약서를 올리거나 바꾸고, 종료 확정 전에 해지 합의서를 올린다(SUPER_ADMIN) — D69 결정 4·5.
   * 종료 지점에는 올리지 못한다(409, ADR-RES-01과 같은 태도 — 해지 합의서는 확정 전에 올린다).
   */
  async setContractFile(branchId: string, input: FileRef & { kind: ContractFileKind }, actorAccountId: string) {
    const file = await this.files.verify(input);
    return this.prisma.$transaction(async (tx) => {
      const { contractStatus, round } = await this.lockContract(tx, branchId);
      if (contractStatus === 'TERMINATED') {
        throw new AppException('BRANCH_TERMINATED', '계약이 종료된 지점에는 계약 파일을 올릴 수 없습니다.', 409);
      }
      const { replaced } = await this.files.attach(tx, round.id, input.kind, file, actorAccountId);
      await recordAudit(tx, {
        actorId: actorAccountId,
        entity: 'Branch',
        entityId: branchId,
        action: replaced ? 'CONTRACT_FILE_REPLACED' : 'CONTRACT_FILE_UPLOADED',
        after: { roundNo: round.roundNo, kind: input.kind, fileName: file.fileName },
      });
      return this.view(tx, branchId);
    });
  }

  /** 계약 쓰기끼리와 채용·발령의 공유 락(lockBranchForShare)을 직렬화하는 지점 행 배타 락 + 진행 중 회차. */
  private async lockContract(tx: Prisma.TransactionClient, branchId: string): Promise<LockedContract> {
    const [row] = await tx.$queryRaw<Array<{ contractStatus: BranchContractStatus }>>`
      SELECT "contractStatus" FROM "Branch" WHERE "id" = ${branchId} FOR UPDATE`;
    if (!row) throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
    const round = await tx.contractRound.findFirst({ where: { branchId }, orderBy: { roundNo: 'desc' } });
    if (!round) throw missingRound(branchId);
    return { contractStatus: row.contractStatus, round };
  }

  private async view(tx: Prisma.TransactionClient, branchId: string) {
    return BranchService.toContractView(await tx.branch.findUniqueOrThrow({ where: { id: branchId }, include: CURRENT_ROUND }));
  }

  /** SUPER_ADMIN은 전 지점, 그 외는 자기 지점만(지점 데이터 격리). */
  listVisibleTo(user: RequestUser): Promise<BranchWithRound[]> {
    if (user.role === 'SUPER_ADMIN') return this.prisma.branch.findMany({ include: CURRENT_ROUND });
    if (!user.branchId) return Promise.resolve([]);
    return this.prisma.branch.findMany({ where: { id: user.branchId }, include: CURRENT_ROUND });
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
   * API 응답 형식 — @db.Date 컬럼을 "YYYY-MM-DD"로(이관 전 mock 응답과 같은 형식). 계약 값은 진행 중 회차(D69).
   * D68 결정 4 — 남은 일수와 갱신 알림은 스케줄러 없이 조회 때 계산한다. 알림은 상태가 정상인데 종료가 60일 안으로
   * 들어온 경우만(이미 갱신 임박·만료로 바꾼 지점은 본사가 알고 있다). 상태를 자동으로 바꾸지는 않는다.
   */
  static toContractView(branch: BranchWithRound) {
    const round = branch.contractRounds[0];
    if (!round) throw missingRound(branch.id);
    const endAt = toKstDateString(round.endAt);
    const daysLeft = Math.round((dateOf(endAt).getTime() - dateOf(todayKst()).getTime()) / DAY_MS);
    const has = (kind: ContractFileKind) => round.files.some((f) => f.kind === kind);
    return {
      id: branch.id,
      name: branch.name,
      region: branch.region,
      contractStatus: branch.contractStatus,
      contractRoundNo: round.roundNo,
      contractPartner: round.partner,
      contractStartAt: toKstDateString(round.startAt),
      contractEndAt: endAt,
      contractDaysLeft: daysLeft,
      renewalNotice: branch.contractStatus === 'ACTIVE' && daysLeft >= 0 && daysLeft <= RENEWAL_NOTICE_DAYS,
      hasContractFile: has('CONTRACT'),
      hasTerminationAgreement: has('TERMINATION_AGREEMENT'),
    };
  }
}

function checkPeriod(startAt: string, endAt: string) {
  if (endAt < startAt) {
    throw new AppException('INVALID_CONTRACT_PERIOD', '계약 종료일이 시작일보다 앞설 수 없습니다.', 400);
  }
}

// 모든 지점은 1회차를 갖는다(마이그레이션이 옮기고 등록이 만든다). 없으면 데이터가 깨진 것이라 조용히 넘기지 않는다.
function missingRound(branchId: string) {
  return new AppException('CONTRACT_ROUND_MISSING', `지점(${branchId})의 계약 회차가 없습니다. 본사 관리자에게 알려 주세요.`, 500);
}
