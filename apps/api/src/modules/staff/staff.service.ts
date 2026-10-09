import { Injectable } from '@nestjs/common';
import { Prisma, Role, Staff, StaffAssignment } from '@prisma/client';
import { MOCK_DEMO_PASSWORD } from '../../fixtures/demo-password';
import { MockStaff, MockStaffAssignment } from '../../fixtures/mock-data.types';
import { AppException } from '../../common/exceptions/app.exception';
import { todayKst, toKstDateString } from '../../common/date/kst-date';
import { recordAudit } from '../../prisma/audit';
import { PrismaService } from '../../prisma/prisma.service';
import { allocateBranchCode } from '../../prisma/integrity';
import { recalculateHrRetention } from '../documents/document.service';
import * as bcrypt from 'bcrypt';

type StaffRow = Staff & { branch: { name: string } };
export type StaffView = MockStaff & { branchName: string };

const dateOf = (d: string) => new Date(`${d}T00:00:00Z`);

/**
 * 직원·파견·관리자 계정 — D30. 원천은 DB다.
 * D30~D35 동안 아직 mock인 도메인을 위해 mock에 직원·파견·계정 "미러"를 채웠지만, D36(게시판 이관)으로
 * 마지막 독자가 사라져 미러와 MockDataService를 모두 없앴다.
 */
@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 조회 ──────────────────────────────────────────────

  /** 인사정보관리 A-5 — 퇴사자는 기본적으로 숨기고(status!=RESIGNED), status를 명시하면 그 값만(인사정보관리 A-6). */
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

  /** 인사정보관리 A-5 GET /staff/:id/assignments — 최신 파견이 먼저. */
  // 지점명을 붙여 준다 — 지점 관리자는 GET /branches로 자기 지점만 보므로 화면이 예전 파견 지점 이름을 알 길이 없다(log/090).
  async history(staffId: string): Promise<Array<MockStaffAssignment & { branchName: string }>> {
    const rows = await this.prisma.staffAssignment.findMany({
      where: { staffId },
      include: { branch: { select: { name: true } } },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((a) => ({ ...toMockAssignment(a), branchName: a.branch.name }));
  }

  // ── 쓰기 ──────────────────────────────────────────────

  /**
   * 신규 채용 — SUPER_ADMIN 전용(컨트롤러). 계정 + 직원 + 최초 파견을 한 트랜잭션으로 만들고(인사정보관리 A-3),
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
    // ADR-MEM-02 — 활성 계정끼리 이메일 유일. D32부터 회원 계정도 DB라 DB 한 곳만 본다(D30 결정 4 종료).
    if (await this.prisma.account.findFirst({ where: { email: input.email, isActive: true }, select: { id: true } })) {
      throw emailTaken();
    }
    const hireDate = input.hireDate ?? todayKst();
    const passwordHash = await bcrypt.hash(MOCK_DEMO_PASSWORD, 10); // 채용 시 임시 비밀번호(데모) — 기존 mock 동작과 같다

    let staffId: string;
    try {
      staffId = await this.prisma.$transaction(async (tx) => {
        const branch = await tx.branch.findUnique({
          where: { id: input.branchId },
          select: { id: true, code: true, contractStatus: true },
        });
        if (!branch) throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
        // 계약 종료 지점은 신규 활동 차단(CLAUDE.md 불변식) — 채용(=최초 파견)도 새 파견이다(log/090).
        if (branch.contractStatus === 'TERMINATED') throw terminatedBranch();

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

  /** 인사정보관리 A-5 PATCH /staff/:id — 지점은 파견 발령으로만 바꾼다. 파트타임은 휴무 요일을 쓰지 않는다(ATT-T05). */
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
   * 인사서류 보존기한 재계산(ADR-RES-02)도 같은 트랜잭션에서 한다 — D34로 문서가 DB로 옮겨져
   * D30 결정 3의 "커밋 뒤 mock 적용"이 끝났다(data-integrity §6 퇴사 체크리스트).
   */
  async resign(id: string, actorAccountId: string): Promise<StaffView> {
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
      await recalculateHrRetention(tx, id, today);
      // D44 — 누가 퇴사 처리했는지(같은 트랜잭션).
      await recordAudit(tx, {
        actorId: actorAccountId,
        entity: 'Staff',
        entityId: id,
        action: 'RESIGNED',
        before: { status: staff.status, branchId: staff.branchId },
        after: { status: 'RESIGNED', resignDate: today },
      });
    });
    return this.afterWrite(id);
  }

  /**
   * 파견 발령 — 옛 파견 종료 → 새 파견 → 담당 회원 해제 → 강사 연결 해제 → Staff.branchId 갱신을 이 순서로
   * 한 트랜잭션에(ADR-STF-01·STF-04). 순서가 바뀌면 D28 트리거(staff_branch_move)가 거부한다.
   * 담당이 풀린 회원 목록을 응답에 돌려준다(ADR-STF-04 가시화). D32부터 회원·강사 모두 DB가 원천이라
   * 부수효과가 전부 이 트랜잭션 안에 있다(D30 결정 3의 "커밋 뒤 mock 적용"이 끝남).
   */
  async assign(
    id: string,
    newBranchId: string,
    assignedByAccountId: string,
    note?: string,
  ): Promise<StaffView & { unassignedMembers: Array<{ id: string; name: string }> }> {
    const today = dateOf(todayKst());
    const unassignedMembers = await this.prisma.$transaction(async (tx) => {
      const staff = await tx.staff.findUnique({ where: { id } });
      if (!staff) throw staffNotFound();
      if (staff.status === 'RESIGNED') {
        throw new AppException('STAFF_ALREADY_RESIGNED', '퇴사한 직원은 재파견할 수 없습니다.', 409);
      }
      const target = await tx.branch.findUnique({ where: { id: newBranchId }, select: { contractStatus: true } });
      if (!target) throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
      // Prisma 도메인이라 gate 대신 트랜잭션 안에서 지점을 직접 읽는다(branch-gate.ts 주석). 떠나는 지점이 종료여도 막지 않는다(log/090).
      if (target.contractStatus === 'TERMINATED') throw terminatedBranch();
      await tx.staffAssignment.updateMany({ where: { staffId: id, endDate: null }, data: { endDate: today } });
      await tx.staffAssignment.create({
        data: { staffId: id, branchId: newBranchId, startDate: today, assignedBy: assignedByAccountId, note },
      });
      const released = await tx.member.findMany({
        where: { assignedStaffId: id, branchId: { not: newBranchId } },
        select: { id: true, name: true },
        orderBy: { memberNo: 'asc' },
      });
      await tx.member.updateMany({
        where: { id: { in: released.map((m) => m.id) } },
        data: { assignedStaffId: null },
      });
      await tx.instructor.updateMany({
        where: { staffId: id, branchId: { not: newBranchId } },
        data: { staffId: null, isActive: false },
      });
      await tx.staff.update({ where: { id }, data: { branchId: newBranchId } });
      // D44 — 재배치 이력. StaffAssignment.assignedBy와 별개로 감사 기록 한 곳에서 인사 변경을 모아 본다.
      await recordAudit(tx, {
        actorId: assignedByAccountId,
        entity: 'Staff',
        entityId: id,
        action: 'ASSIGNED',
        before: { branchId: staff.branchId },
        after: { branchId: newBranchId, note: note ?? null, releasedMemberCount: released.length },
      });
      return released;
    });
    return { ...(await this.afterWrite(id)), unassignedMembers };
  }

  // ── 권한(권한관리 A-7) — 본사만 STAFF ↔ BRANCH_ADMIN 전환 ────────────────

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
  async updateRole(staffId: string, role: Extract<Role, 'STAFF' | 'BRANCH_ADMIN'>, actorAccountId: string) {
    // D44 — 역할 변경과 이력을 한 트랜잭션으로 묶는다(D17 숙제: 누가 언제 승진·강등시켰는지). 같은 값이면 기록하지 않는다.
    await this.prisma.$transaction(async (tx) => {
      const staff = await tx.staff.findUnique({ where: { id: staffId }, include: { account: { select: { role: true } } } });
      if (!staff) throw staffNotFound();
      if (staff.account.role === role) return;
      await tx.account.update({ where: { id: staff.accountId }, data: { role } });
      await recordAudit(tx, {
        actorId: actorAccountId,
        entity: 'Staff',
        entityId: staffId,
        action: 'ROLE_CHANGED',
        before: { role: staff.account.role },
        after: { role },
      });
    });
    await this.afterWrite(staffId);
    return (await this.listWithRole()).find((s) => s.staffId === staffId);
  }

  /** 커밋된 직원 한 명을 다시 읽어 응답 형식으로 돌려준다. */
  private async afterWrite(staffId: string): Promise<StaffView> {
    const row = await this.prisma.staff.findUniqueOrThrow({
      where: { id: staffId },
      include: { branch: { select: { name: true } } },
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

function terminatedBranch() {
  return new AppException('BRANCH_TERMINATED', '위탁계약이 종료된 지점에는 직원을 파견할 수 없습니다.', 409);
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

function toView(row: StaffRow): StaffView {
  return { ...toMockStaff(row), branchName: row.branch.name };
}
