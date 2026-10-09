import { Injectable } from '@nestjs/common';
import {
  CourseEnrollment,
  Member,
  MemberStatus,
  PTSession,
  PTSessionLog,
  Prisma,
} from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { todayKst, toKstDateString } from '../../common/date/kst-date';
import { PageRequest } from '../../common/http/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { allocateBranchCode } from '../../prisma/integrity';
import { BranchService } from '../branches/branch.service';
import { MockCourseEnrollment, MockMember, MockPTSession, MockPTSessionLog } from '../../fixtures/mock-data.types';

export type MemberView = MockMember & { branchName?: string; assignedStaffName?: string };
type PTView = MockPTSession & { remainingSessions: number; programName?: string };

const MEMBER_STATUSES: MemberStatus[] = ['ACTIVE', 'DORMANT', 'WITHDRAWN'];
// ADR-MEM-01 — 회원번호+전화번호 브루트포스 방어: 대상 회원번호별 시간당 5회 실패 제한.
const LINK_MAX_ATTEMPTS_PER_HOUR = 5;
const LINK_WINDOW_MS = 60 * 60 * 1000;

const dateOf = (d: string) => new Date(`${d}T00:00:00Z`);
const withNames = { branch: { select: { name: true } }, assignedStaff: { select: { name: true } } } as const;
type MemberRow = Member & { branch: { name: string }; assignedStaff: { name: string } | null };

type ProfileInput = {
  name: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
  assignedStaffId?: string;
  guardianConsent?: boolean;
  memo?: string;
};

/**
 * 회원·회원 계정·수강·PT — D32. 원천은 DB이고 mock 미러는 없다
 * (이 데이터를 동기적으로 읽는 mock 도메인이 남지 않았다 — D32 결정 1).
 */
@Injectable()
export class MemberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchService: BranchService,
  ) {}

  // ── 조회 ──────────────────────────────────────────────

  /**
   * D43 — 쪽 단위로 자르고 total을 함께 준다. 필터는 모두 where에 넣는다(메모리에서 거르면 total·쪽이 틀린다).
   * assignedStaffId='none'이면 담당 직원이 없는 회원(지점 상세 "담당 없음", log/088).
   */
  async list(
    filter: { branchId?: string; status?: string; q?: string; assignedStaffId?: string },
    page: PageRequest,
  ): Promise<{ items: MemberView[]; total: number }> {
    // 예전 mock은 모르는 상태값으로 거르면 빈 목록이었다 — enum 밖 값을 DB로 보내 500이 나지 않게 유지.
    if (filter.status && !MEMBER_STATUSES.includes(filter.status as MemberStatus)) return { items: [], total: 0 };
    const needle = filter.q?.trim().toLowerCase();
    const where: Prisma.MemberWhereInput = {
      branchId: filter.branchId,
      status: filter.status as MemberStatus | undefined,
      assignedStaffId: filter.assignedStaffId === 'none' ? null : filter.assignedStaffId || undefined,
      OR: needle
        ? [
            { name: { contains: needle, mode: 'insensitive' } },
            { memberNo: { contains: needle, mode: 'insensitive' } },
            { phone: { contains: needle } },
          ]
        : undefined,
    };
    const [total, rows] = await Promise.all([
      this.prisma.member.count({ where }),
      this.prisma.member.findMany({
        where,
        include: withNames,
        orderBy: [{ memberNo: 'asc' }, { id: 'asc' }],
        skip: page.skip,
        take: page.pageSize,
      }),
    ]);
    return { items: rows.map(toView), total };
  }

  async findById(id: string): Promise<MockMember | null> {
    const row = await this.prisma.member.findUnique({ where: { id } });
    return row ? toMockMember(row) : null;
  }

  async view(id: string): Promise<MemberView> {
    return toView(await this.prisma.member.findUniqueOrThrow({ where: { id }, include: withNames }));
  }

  // ADR-MEM-03 — 상세 진입 시 요약 카운트만. "수강중 N건"은 ACTIVE만 센다.
  async summary(memberId: string): Promise<{ enrollmentCount: number; ptRemainingTotal: number; lastPaymentAt?: string }> {
    const [enrollmentCount, pts, lastPayment] = await Promise.all([
      this.prisma.courseEnrollment.count({ where: { memberId, status: 'ACTIVE' } }),
      this.prisma.pTSession.findMany({ where: { memberId }, select: { totalSessions: true, usedSessions: true } }),
      this.prisma.payment.findFirst({
        where: { memberId, approvedAt: { not: null } },
        orderBy: { approvedAt: 'desc' },
        select: { approvedAt: true },
      }),
    ]);
    return {
      enrollmentCount,
      ptRemainingTotal: pts.reduce((sum, s) => sum + (s.totalSessions - s.usedSessions), 0),
      lastPaymentAt: lastPayment?.approvedAt?.toISOString(),
    };
  }

  async listEnrollments(memberId: string): Promise<Array<MockCourseEnrollment & { programName?: string }>> {
    const rows = await this.prisma.courseEnrollment.findMany({
      where: { memberId },
      include: { program: { select: { name: true } } },
      orderBy: [{ enrolledAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => ({ ...toMockEnrollment(r), programName: r.program.name }));
  }

  async listPTSessions(memberId: string): Promise<Array<PTView & { logs: MockPTSessionLog[] }>> {
    const rows = await this.prisma.pTSession.findMany({
      where: { memberId },
      include: { program: { select: { name: true } }, logs: { orderBy: { usedAt: 'asc' } } },
      orderBy: [{ purchasedAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => ({ ...toPTView(r, r.program.name), logs: r.logs.map(toMockLog) }));
  }

  async findPTSession(id: string): Promise<MockPTSession | null> {
    const row = await this.prisma.pTSession.findUnique({ where: { id } });
    return row ? toMockPT(row) : null;
  }

  // ── 쓰기: 회원 ─────────────────────────────────────────

  // 회원관리 A-5 POST /members — 현장 오프라인 등록. BRANCH_ADMIN 전용(컨트롤러에서 강제).
  async create(branchId: string, input: ProfileInput): Promise<{ member: MemberView; warnings: string[] }> {
    const branch = await this.assertCanRegister(branchId, input);
    const warnings = await this.duplicatePhoneWarnings(branchId, input.phone);
    const id = await this.prisma.$transaction(async (tx) => {
      const member = await tx.member.create({ data: await this.memberData(tx, branch, input) });
      return member.id;
    });
    return { member: await this.view(id), warnings };
  }

  // ADR-MEM-02 — 앱 회원가입. Account+Member를 한 트랜잭션에서 만든다. 이메일 중복을 가장 먼저 본다
  // (예전 mock과 같은 에러 우선순위). 경합으로 부분 unique를 위반하면 같은 409로 바꾼다.
  async register(input: ProfileInput & { branchId: string; email: string; passwordHash: string }): Promise<{
    member: MemberView;
    accountId: string;
    warnings: string[];
  }> {
    await this.assertEmailAvailable(input.email);
    const branch = await this.assertCanRegister(input.branchId, input);
    const warnings = await this.duplicatePhoneWarnings(input.branchId, input.phone);
    const { memberId, accountId } = await this.withEmailConflict(() =>
      this.prisma.$transaction(async (tx) => {
        const account = await tx.account.create({
          data: { email: input.email, passwordHash: input.passwordHash, role: 'MEMBER', name: input.name },
        });
        const member = await tx.member.create({
          data: { ...(await this.memberData(tx, branch, input)), accountId: account.id },
        });
        return { memberId: member.id, accountId: account.id };
      }),
    );
    return { member: await this.view(memberId), accountId, warnings };
  }

  // ADR-MEM-01 — 오프라인 등록 회원이 회원번호+전화번호로 본인을 증명하고 앱 계정을 만들어 연동한다.
  // 실패 기록은 MemberLinkAttempt(DB)에 남긴다 — 인스턴스가 여럿이거나 재시작돼도 제한이 유지된다(D32 결정 4).
  async link(input: { memberNo: string; phone: string; email: string; passwordHash: string }): Promise<string> {
    const since = new Date(Date.now() - LINK_WINDOW_MS);
    const recentFailures = await this.prisma.memberLinkAttempt.count({
      where: { memberNo: input.memberNo, attemptedAt: { gt: since } },
    });
    if (recentFailures >= LINK_MAX_ATTEMPTS_PER_HOUR) {
      throw new AppException('LINK_ATTEMPTS_EXCEEDED', '연동 시도 횟수를 초과했습니다. 1시간 후 다시 시도하세요.', 429);
    }
    // 회원번호 불일치·전화번호 불일치·탈퇴 회원을 같은 메시지로 묶는다 — 부분 정보를 주지 않기 위함(회원관리 §8 질문 1).
    const member = await this.prisma.member.findFirst({
      where: { memberNo: input.memberNo, phone: input.phone, status: { not: 'WITHDRAWN' } },
    });
    if (!member) {
      await this.prisma.memberLinkAttempt.create({ data: { memberNo: input.memberNo } });
      throw new AppException('MEMBER_LINK_MISMATCH', '회원번호 또는 전화번호가 일치하지 않습니다.', 400);
    }
    if (member.accountId) {
      throw new AppException('MEMBER_ALREADY_LINKED', '이미 앱 계정과 연동된 회원입니다.', 409);
    }
    await this.assertEmailAvailable(input.email);
    return this.withEmailConflict(() =>
      this.prisma.$transaction(async (tx) => {
        const account = await tx.account.create({
          data: { email: input.email, passwordHash: input.passwordHash, role: 'MEMBER', name: member.name },
        });
        // 동시에 두 연동이 들어와도 한 계정만 붙게, 아직 비어 있을 때만 연결한다.
        const { count } = await tx.member.updateMany({
          where: { id: member.id, accountId: null },
          data: { accountId: account.id },
        });
        if (count === 0) {
          throw new AppException('MEMBER_ALREADY_LINKED', '이미 앱 계정과 연동된 회원입니다.', 409);
        }
        return account.id;
      }),
    );
  }

  // 회원관리 A-5 PATCH /members/:id — 지점/본인 범위 검증은 컨트롤러가 먼저 마친다.
  async update(
    id: string,
    input: Partial<Pick<MockMember, 'name' | 'phone' | 'birthDate' | 'gender' | 'memo' | 'assignedStaffId'>>,
  ): Promise<MemberView> {
    const member = await this.requireMember(id);
    const data: Prisma.MemberUncheckedUpdateInput = {
      name: input.name,
      phone: input.phone,
      birthDate: input.birthDate !== undefined ? dateOf(input.birthDate) : undefined,
      gender: input.gender,
      memo: input.memo,
    };
    if (input.assignedStaffId !== undefined) {
      if (input.assignedStaffId) await this.assertStaffInBranch(input.assignedStaffId, member.branchId);
      data.assignedStaffId = input.assignedStaffId || null;
    }
    await this.prisma.member.update({ where: { id }, data });
    return this.view(id);
  }

  // 회원관리 A-5 PATCH /members/:id/status, 회원관리 A-6 "탈퇴 시 소프트 삭제 + Account.isActive=false".
  // WITHDRAWN이 아니면 다시 로그인 가능하게 푼다 — 안 풀면 탈퇴 취소 후에도 영구히 로그인 불가로 남는다.
  async updateStatus(id: string, status: MemberStatus): Promise<MemberView> {
    const member = await this.requireMember(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.member.update({ where: { id }, data: { status } });
      if (member.accountId) {
        await tx.account.update({ where: { id: member.accountId }, data: { isActive: status !== 'WITHDRAWN' } });
      }
    });
    return this.view(id);
  }

  // ── 쓰기: 수강·PT(ADR-MEM-03) ───────────────────────────

  async createEnrollment(
    memberId: string,
    input: { programId: string; enrolledAt: string; expiresAt?: string },
  ): Promise<MockCourseEnrollment & { programName?: string }> {
    const member = await this.assertBranchNotTerminatedForMember(memberId);
    const program = await this.assertProgramInBranch(input.programId, member.branchId);
    const row = await this.prisma.courseEnrollment.create({
      data: {
        memberId,
        programId: input.programId,
        enrolledAt: dateOf(input.enrolledAt),
        expiresAt: input.expiresAt ? dateOf(input.expiresAt) : null,
        status: 'ACTIVE',
      },
    });
    return { ...toMockEnrollment(row), programName: program.name };
  }

  // PT_PACKAGE 결제 연동은 범위 제외라 관리자가 구매 사실을 직접 등록한다(예약및결제 A-3).
  async createPTSession(
    memberId: string,
    input: { programId: string; totalSessions: number; purchasedAt: string },
  ): Promise<PTView> {
    const member = await this.assertBranchNotTerminatedForMember(memberId);
    const program = await this.assertProgramInBranch(input.programId, member.branchId);
    const row = await this.prisma.pTSession.create({
      data: {
        memberId,
        programId: input.programId,
        totalSessions: input.totalSessions,
        usedSessions: 0,
        purchasedAt: dateOf(input.purchasedAt),
      },
    });
    return toPTView(row, program.name);
  }

  // 잔여세션 차감은 계약종료 차단 대상이 아니다(기존 계약의 이행). 동시에 두 번 눌러도 총 세션을 넘지 않게
  // "남아 있을 때만 +1"을 한 문장으로 하고, 사용 기록을 같은 트랜잭션에 남긴다.
  async usePTSession(id: string, note?: string): Promise<PTView> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.pTSession.findUnique({ where: { id } });
      if (!session) throw new AppException('PT_SESSION_NOT_FOUND', 'PT 세션을 찾을 수 없습니다.', 404);
      const updated = await tx.$executeRaw`
        UPDATE "PTSession" SET "usedSessions" = "usedSessions" + 1
        WHERE "id" = ${id} AND "usedSessions" < "totalSessions"`;
      if (updated === 0) throw new AppException('PT_SESSION_EXHAUSTED', '남은 세션이 없습니다.', 409);
      await tx.pTSessionLog.create({ data: { ptSessionId: id, note } });
      const row = await tx.pTSession.findUniqueOrThrow({
        where: { id },
        include: { program: { select: { name: true } } },
      });
      return toPTView(row, row.program.name);
    });
  }

  // ── 내부 ──────────────────────────────────────────────

  private async requireMember(id: string): Promise<Member> {
    const row = await this.prisma.member.findUnique({ where: { id } });
    if (!row) throw new AppException('MEMBER_NOT_FOUND', '회원을 찾을 수 없습니다.', 404);
    return row;
  }

  /** 등록 공통 검증(예전 mock createMember 순서): 지점 존재 → 계약 종료 → 담당 직원 지점 → 미성년 동의. */
  private async assertCanRegister(branchId: string, input: ProfileInput): Promise<{ id: string; code: string }> {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, code: true } });
    if (!branch) throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
    if ((await this.branchService.loadGate()).isTerminated(branchId)) {
      throw new AppException('BRANCH_TERMINATED', '위탁계약이 종료된 지점에는 신규 회원을 등록할 수 없습니다.', 409);
    }
    if (input.assignedStaffId) await this.assertStaffInBranch(input.assignedStaffId, branchId);
    // 회원관리 A-6 — 만 19세 미만은 법정대리인 동의 없이는 등록 자체를 막는다. birthDate가 없으면 검사 대상 아님.
    if (input.birthDate && isMinor(input.birthDate) && !input.guardianConsent) {
      throw new AppException('GUARDIAN_CONSENT_REQUIRED', '만 19세 미만 회원은 법정대리인 동의가 필요합니다.', 400);
    }
    return branch;
  }

  private async duplicatePhoneWarnings(branchId: string, phone?: string): Promise<string[]> {
    if (!phone) return [];
    const dup = await this.prisma.member.count({ where: { branchId, phone, status: 'ACTIVE' } });
    return dup > 0 ? ['같은 지점에 동일한 전화번호를 쓰는 활성 회원이 이미 있습니다.'] : [];
  }

  /** 회원번호는 지점·연도별 시퀀스로 채번한다(ADR-STF-02 패턴, D32 결정 4 — KST 연도). */
  private async memberData(
    tx: Prisma.TransactionClient,
    branch: { id: string; code: string },
    input: ProfileInput,
  ): Promise<Prisma.MemberUncheckedCreateInput> {
    return {
      branchId: branch.id,
      assignedStaffId: input.assignedStaffId ?? null,
      memberNo: await allocateBranchCode(tx, branch, 'MEMBER'),
      name: input.name,
      phone: input.phone ?? null,
      birthDate: input.birthDate ? dateOf(input.birthDate) : null,
      gender: input.gender ?? null,
      guardianConsent: input.guardianConsent ?? false,
      memo: input.memo ?? null,
      status: 'ACTIVE',
      joinedAt: dateOf(todayKst()),
    };
  }

  private async assertStaffInBranch(staffId: string, branchId: string): Promise<void> {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId }, select: { branchId: true } });
    if (!staff || staff.branchId !== branchId) {
      throw new AppException('STAFF_BRANCH_MISMATCH', '담당 직원은 회원과 같은 지점 소속이어야 합니다.', 400);
    }
  }

  // ADR-MEM-03 — 다른 도메인과 같은 계약종료 지점 신규활동 차단.
  private async assertBranchNotTerminatedForMember(memberId: string): Promise<Member> {
    const member = await this.requireMember(memberId);
    if ((await this.branchService.loadGate()).isTerminated(member.branchId)) {
      throw new AppException('BRANCH_TERMINATED', '위탁계약이 종료된 지점에는 신규 수강·PT 세션을 등록할 수 없습니다.', 409);
    }
    return member;
  }

  private async assertProgramInBranch(programId: string, branchId: string): Promise<{ name: string }> {
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: { branchId: true, name: true } });
    if (!program || program.branchId !== branchId) {
      throw new AppException('PROGRAM_BRANCH_MISMATCH', '프로그램은 회원과 같은 지점 소속이어야 합니다.', 400);
    }
    return program;
  }

  // ADR-MEM-02 — 탈퇴 계정의 이메일은 재사용 가능(활성 계정끼리만 유일, 부분 unique).
  private async assertEmailAvailable(email: string): Promise<void> {
    if (await this.prisma.account.findFirst({ where: { email, isActive: true }, select: { id: true } })) {
      throw new AppException('EMAIL_ALREADY_EXISTS', '이미 사용 중인 이메일입니다.', 409);
    }
  }

  private async withEmailConflict<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppException('EMAIL_ALREADY_EXISTS', '이미 사용 중인 이메일입니다.', 409);
      }
      throw e;
    }
  }
}

// 회원관리 A-6 — 만 19세 미만 판정(생일 지남 여부까지 반영한 만 나이). "오늘"은 KST(date-time-handling.md).
function isMinor(birthDate: string): boolean {
  const [by, bm, bd] = birthDate.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = todayKst().split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age < 19;
}

export function toMockMember(row: Member): MockMember {
  return {
    id: row.id,
    accountId: row.accountId ?? undefined,
    branchId: row.branchId,
    assignedStaffId: row.assignedStaffId ?? undefined,
    memberNo: row.memberNo,
    name: row.name,
    phone: row.phone ?? undefined,
    birthDate: row.birthDate ? toKstDateString(row.birthDate) : undefined,
    gender: row.gender ?? undefined,
    status: row.status,
    joinedAt: toKstDateString(row.joinedAt),
    guardianConsent: row.guardianConsent,
    memo: row.memo ?? undefined,
  };
}

function toView(row: MemberRow): MemberView {
  return { ...toMockMember(row), branchName: row.branch.name, assignedStaffName: row.assignedStaff?.name };
}

function toMockEnrollment(row: CourseEnrollment): MockCourseEnrollment {
  return {
    id: row.id,
    memberId: row.memberId,
    programId: row.programId,
    enrolledAt: toKstDateString(row.enrolledAt),
    expiresAt: row.expiresAt ? toKstDateString(row.expiresAt) : undefined,
    status: row.status,
  };
}

function toMockPT(row: PTSession): MockPTSession {
  return {
    id: row.id,
    memberId: row.memberId,
    programId: row.programId,
    totalSessions: row.totalSessions,
    usedSessions: row.usedSessions,
    purchasedAt: toKstDateString(row.purchasedAt),
  };
}

function toPTView(row: PTSession, programName?: string): PTView {
  return { ...toMockPT(row), remainingSessions: row.totalSessions - row.usedSessions, programName };
}

function toMockLog(row: PTSessionLog): MockPTSessionLog {
  return { id: row.id, ptSessionId: row.ptSessionId, usedAt: row.usedAt.toISOString(), note: row.note ?? undefined };
}

