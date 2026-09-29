import { Injectable, OnModuleInit } from '@nestjs/common';
import { Account, Prisma, Role, Staff, StaffAssignment } from '@prisma/client';
import { MOCK_DEMO_PASSWORD, MockDataService } from '../../mock-data/mock-data.service';
import { MockAccount, MockStaff, MockStaffAssignment } from '../../mock-data/mock-data.types';
import { AppException } from '../../common/exceptions/app.exception';
import { todayKst, toKstDateString } from '../../common/date/kst-date';
import { PrismaService } from '../../prisma/prisma.service';
import { allocateBranchCode } from '../../prisma/integrity';
import { InstructorService } from '../instructors/instructor.service';
import * as bcrypt from 'bcrypt';

type StaffRow = Staff & { branch: { name: string } };
export type StaffView = MockStaff & { branchName: string };

const dateOf = (d: string) => new Date(`${d}T00:00:00Z`);

/**
 * 직원·파견·관리자 계정 — D30(2-1_기술결정사항.md). 원천은 DB다.
 *
 * 아직 mock인 근태·휴가·업무일지·문서·회원·작성자 이름이 직원을 동기적으로 읽으므로, mock에는 "미러"를 둔다.
 * 앱이 뜰 때(onModuleInit) DB 전체로 채우고, 이 서비스의 쓰기가 커밋된 뒤 해당 직원만 다시 읽어 갱신한다.
 * 미러는 이 서비스만 쓴다 — 직원을 바꾸는 다른 경로가 생기면 미러가 낡는다.
 */
@Injectable()
export class StaffService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mockData: MockDataService,
    private readonly instructorService: InstructorService,
  ) {}

  async onModuleInit(): Promise<void> {
    const [staff, assignments, accounts] = await Promise.all([
      this.prisma.staff.findMany(),
      this.prisma.staffAssignment.findMany(),
      this.prisma.account.findMany({ where: { role: { not: 'MEMBER' } } }),
    ]);
    const staffByAccount = new Map(staff.map((s) => [s.accountId, s]));
    this.mockData.replaceStaffMirror({
      staff: staff.map(toMockStaff),
      assignments: assignments.map(toMockAssignment),
      accounts: accounts.map((a) => toMockAccount(a, staffByAccount.get(a.id))),
    });
  }

  // ── 조회 ──────────────────────────────────────────────

  /** 02문서 §5 — 퇴사자는 기본적으로 숨기고(status!=RESIGNED), status를 명시하면 그 값만(§6). */
  async list(filter: { branchId?: string; status?: string; position?: string }): Promise<StaffView[]> {
    const rows = await this.prisma.staff.findMany({
      where: {
        branchId: filter.branchId,
        status: filter.status ? (filter.status as Staff['status']) : { not: 'RESIGNED' },
        position: filter.position,
      },
      include: { branch: { select: { name: true } } },
      orderBy: { staffCode: 'asc' },
    });
    return rows.map(toView);
  }

  async findById(id: string): Promise<StaffView | null> {
    const row = await this.prisma.staff.findUnique({ where: { id }, include: { branch: { select: { name: true } } } });
    return row ? toView(row) : null;
  }

  /** 02문서 §5 GET /staff/:id/assignments — 최신 파견이 먼저. */
  async history(staffId: string): Promise<MockStaffAssignment[]> {
    const rows = await this.prisma.staffAssignment.findMany({
      where: { staffId },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toMockAssignment);
  }

  // ── 쓰기 ──────────────────────────────────────────────

  /**
   * 신규 채용 — SUPER_ADMIN 전용(컨트롤러). 계정 + 직원 + 최초 파견을 한 트랜잭션으로 만들고(02문서 §3),
   * 직원번호는 지점별 시퀀스로 채번한다(ADR-STF-02, integrity.ts). 이메일은 활성 계정끼리 유일(ADR-MEM-02 부분 unique).
   */
  async hire(
    input: {
      branchId: string;
      name: string;
      email: string;
      phone?: string;
      position?: string;
      employmentType?: string;
      offDays?: number[];
      hireDate?: string;
      note?: string;
    },
    assignedByAccountId: string,
  ): Promise<StaffView> {
    // 계정이 두 저장소로 나뉜 동안(D30 결정 4): 회원 계정은 아직 mock에 있으므로 거기서도 확인한다.
    if (this.mockData.isEmailTakenByActiveAccount(input.email)) {
      throw emailTaken();
    }
    const hireDate = input.hireDate ?? todayKst();
    const passwordHash = await bcrypt.hash(MOCK_DEMO_PASSWORD, 10); // 채용 시 임시 비밀번호(데모) — 기존 mock 동작과 같다

    let staffId: string;
    try {
      staffId = await this.prisma.$transaction(async (tx) => {
        const branch = await tx.branch.findUnique({ where: { id: input.branchId }, select: { id: true, code: true } });
        if (!branch) throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);

        const account = await tx.account.create({
          data: { email: input.email, passwordHash, role: 'STAFF', name: input.name },
        });
        const staff = await tx.staff.create({
          data: {
            accountId: account.id,
            branchId: branch.id,
            staffCode: await allocateBranchCode(tx, branch, 'STAFF'),
            name: input.name,
            phone: input.phone,
            position: input.position,
            employmentType: input.employmentType,
            offDays: input.employmentType === '파트타임' ? [] : (input.offDays ?? []),
            hireDate: dateOf(hireDate),
          },
        });
        await tx.staffAssignment.create({
          data: {
            staffId: staff.id,
            branchId: branch.id,
            startDate: dateOf(hireDate),
            assignedBy: assignedByAccountId,
            note: input.note,
          },
        });
        return staff.id;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw emailTaken();
      throw e;
    }
    return this.afterWrite(staffId);
  }

  /** 02문서 §5 PATCH /staff/:id — 지점은 파견 발령으로만 바꾼다. 파트타임은 휴무 요일을 쓰지 않는다(ATT-T05). */
  async update(
    id: string,
    input: Partial<Pick<MockStaff, 'name' | 'phone' | 'position' | 'employmentType' | 'offDays'>>,
  ): Promise<StaffView> {
    const current = await this.prisma.staff.findUnique({ where: { id } });
    if (!current) throw staffNotFound();
    const employmentType = input.employmentType ?? current.employmentType;
    const offDays =
      employmentType === '파트타임' ? [] : input.offDays !== undefined ? input.offDays : undefined;
    await this.prisma.staff.update({
      where: { id },
      data: {
        name: input.name,
        phone: input.phone,
        position: input.position,
        employmentType: input.employmentType,
        offDays,
      },
    });
    return this.afterWrite(id);
  }

  /**
   * 퇴사 — 직원 상태·퇴사일 + 계정 비활성화 + 진행 중 파견 종료를 한 트랜잭션으로(ADR-STF-01).
   * JwtStrategy가 매 요청 계정을 다시 읽으므로 이미 발급된 토큰도 다음 요청부터 막힌다(ADR-AUTH-01).
   * 아직 mock인 문서 도메인의 인사서류 보존기한 재계산(ADR-RES-02)은 커밋 뒤 mock에 적용한다(D30 결정 3).
   */
  async resign(id: string): Promise<StaffView> {
    const today = todayKst();
    await this.prisma.$transaction(async (tx) => {
      const staff = await tx.staff.findUnique({ where: { id } });
      if (!staff) throw staffNotFound();
      if (staff.status === 'RESIGNED') {
        throw new AppException('STAFF_ALREADY_RESIGNED', '이미 퇴사 처리된 직원입니다.', 409);
      }
      await tx.staff.update({ where: { id }, data: { status: 'RESIGNED', resignDate: dateOf(today) } });
      await tx.account.update({ where: { id: staff.accountId }, data: { isActive: false } });
      await tx.staffAssignment.updateMany({ where: { staffId: id, endDate: null }, data: { endDate: dateOf(today) } });
    });
    this.mockData.recalculateHrRetention(id, today);
    return this.afterWrite(id);
  }

  /**
   * 파견 발령 — 옛 파견 종료 → 새 파견 → 담당 회원 해제 → 강사 연결 해제 → Staff.branchId 갱신을 이 순서로
   * 한 트랜잭션에(ADR-STF-01·STF-04). 순서가 바뀌면 D28 트리거(staff_branch_move)가 거부한다.
   * 회원의 원천은 아직 mock이라, 커밋 뒤 mock 회원 담당도 해제하고 그 목록을 돌려준다(D30 결정 3).
   * 강사는 D31부터 DB가 원천이라 커밋 뒤 미러만 다시 맞춘다.
   */
  async assign(
    id: string,
    newBranchId: string,
    assignedByAccountId: string,
    note?: string,
  ): Promise<StaffView & { unassignedMembers: Array<{ id: string; name: string }> }> {
    const today = dateOf(todayKst());
    const releasedInstructorIds = await this.prisma.$transaction(async (tx) => {
      const staff = await tx.staff.findUnique({ where: { id } });
      if (!staff) throw staffNotFound();
      if (staff.status === 'RESIGNED') {
        throw new AppException('STAFF_ALREADY_RESIGNED', '퇴사한 직원은 재파견할 수 없습니다.', 409);
      }
      if (!(await tx.branch.findUnique({ where: { id: newBranchId }, select: { id: true } }))) {
        throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
      }
      await tx.staffAssignment.updateMany({ where: { staffId: id, endDate: null }, data: { endDate: today } });
      await tx.staffAssignment.create({
        data: { staffId: id, branchId: newBranchId, startDate: today, assignedBy: assignedByAccountId, note },
      });
      await tx.member.updateMany({
        where: { assignedStaffId: id, branchId: { not: newBranchId } },
        data: { assignedStaffId: null },
      });
      const released = await tx.instructor.findMany({
        where: { staffId: id, branchId: { not: newBranchId } },
        select: { id: true },
      });
      await tx.instructor.updateMany({
        where: { id: { in: released.map((r) => r.id) } },
        data: { staffId: null, isActive: false },
      });
      await tx.staff.update({ where: { id }, data: { branchId: newBranchId } });
      return released.map((r) => r.id);
    });
    // D31 — 강사 원천도 DB가 됐으므로 연결을 푼 강사 행을 미러에 반영한다(ADR-STF-04의 mock 강사 숙제).
    await this.instructorService.refreshMirror(releasedInstructorIds);
    const unassignedMembers = this.mockData.unassignMembersOfStaff(id, newBranchId);
    return { ...(await this.afterWrite(id)), unassignedMembers };
  }

  // ── 권한(01문서 §7) — 본사만 STAFF ↔ BRANCH_ADMIN 전환 ────────────────

  async listWithRole() {
    const rows = await this.prisma.staff.findMany({
      include: { account: { select: { role: true } }, branch: { select: { name: true } } },
      orderBy: { staffCode: 'asc' },
    });
    return rows.map((s) => ({
      staffId: s.id,
      branchId: s.branchId,
      branchName: s.branch.name,
      staffCode: s.staffCode,
      name: s.name,
      position: s.position ?? undefined,
      role: s.account.role,
    }));
  }

  /** 매 요청 계정을 다시 읽는 JwtStrategy 덕분에 재로그인 없이 다음 요청부터 반영된다(ADR-AUTH-01). */
  async updateRole(staffId: string, role: Extract<Role, 'STAFF' | 'BRANCH_ADMIN'>) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw staffNotFound();
    await this.prisma.account.update({ where: { id: staff.accountId }, data: { role } });
    await this.afterWrite(staffId);
    return (await this.listWithRole()).find((s) => s.staffId === staffId);
  }

  /** 커밋된 직원 한 명(직원·파견 이력·계정)을 다시 읽어 mock 미러를 갱신하고 응답 형식으로 돌려준다. */
  private async afterWrite(staffId: string): Promise<StaffView> {
    const row = await this.prisma.staff.findUniqueOrThrow({
      where: { id: staffId },
      include: { branch: { select: { name: true } }, account: true, assignments: true },
    });
    this.mockData.upsertStaffMirror({
      staff: toMockStaff(row),
      assignments: row.assignments.map(toMockAssignment),
      account: toMockAccount(row.account, row),
    });
    return toView(row);
  }
}

function staffNotFound() {
  return new AppException('STAFF_NOT_FOUND', '직원을 찾을 수 없습니다.', 404);
}

function emailTaken() {
  return new AppException('EMAIL_ALREADY_EXISTS', '이미 사용 중인 이메일입니다.', 409);
}

// DB 행 → mock 형태. null은 필드 생략(undefined)으로, 빈 휴무 요일도 생략으로 바꿔 이관 전 응답 형식을 유지한다.
function toMockStaff(s: Staff): MockStaff {
  return {
    id: s.id,
    accountId: s.accountId,
    branchId: s.branchId,
    staffCode: s.staffCode,
    name: s.name,
    phone: s.phone ?? undefined,
    position: s.position ?? undefined,
    employmentType: s.employmentType ?? undefined,
    offDays: s.offDays.length ? s.offDays : undefined,
    hireDate: toKstDateString(s.hireDate),
    resignDate: s.resignDate ? toKstDateString(s.resignDate) : undefined,
    status: s.status,
  };
}

function toMockAssignment(a: StaffAssignment): MockStaffAssignment {
  return {
    id: a.id,
    staffId: a.staffId,
    branchId: a.branchId,
    startDate: toKstDateString(a.startDate),
    endDate: a.endDate ? toKstDateString(a.endDate) : undefined,
    assignedBy: a.assignedBy,
    note: a.note ?? undefined,
  };
}

function toMockAccount(a: Account, staff?: Staff): MockAccount {
  return {
    id: a.id,
    email: a.email,
    passwordHash: a.passwordHash,
    role: a.role,
    name: a.name,
    isActive: a.isActive,
    branchId: staff?.branchId,
    staffId: staff?.id,
  };
}

function toView(row: StaffRow): StaffView {
  return { ...toMockStaff(row), branchName: row.branch.name };
}
