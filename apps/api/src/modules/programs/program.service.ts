import { Injectable } from '@nestjs/common';
import { Prisma, Program, ScheduleSlot } from '@prisma/client';
import { MockProgram, MockScheduleSlot } from '../../mock-data/mock-data.types';
import { AppException } from '../../common/exceptions/app.exception';
import { todayKst, toKstDateString } from '../../common/date/kst-date';
import { PrismaService } from '../../prisma/prisma.service';
import { ACTIVE_RESERVATION_STATUSES } from '../../prisma/integrity';

export type ProgramView = MockProgram & { branchName?: string; instructorName?: string };

type ProgramInput = {
  name: string;
  category: string;
  ageGroup: MockProgram['ageGroup'];
  description?: string;
  pricingType: MockProgram['pricingType'];
  price: number;
  capacity?: number;
  facilityId?: string;
  instructorId?: string;
  startDate: string;
  endDate?: string;
};

// 강사프로그램게시 A-3 상태 전이표. ENDED는 종결 상태라 다음 상태가 없다.
const PROGRAM_STATUS_TRANSITIONS: Record<MockProgram['status'], MockProgram['status'][]> = {
  PREPARING: ['RUNNING', 'ENDED'],
  RUNNING: ['PAUSED', 'ENDED'],
  PAUSED: ['RUNNING', 'ENDED'],
  ENDED: [],
};
const PROGRAM_STATUSES = Object.keys(PROGRAM_STATUS_TRANSITIONS);
const PRICING_TYPES: MockProgram['pricingType'][] = ['FREE_ACCESS', 'PAID_SESSION', 'PT_PACKAGE'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const dateOf = (d: string) => new Date(`${d}T00:00:00Z`);
const withNames = { branch: { select: { name: true } }, instructor: { select: { name: true } } } as const;

const ACTIVE = [...ACTIVE_RESERVATION_STATUSES] as Array<'REQUESTED' | 'CONFIRMED'>;

/**
 * 프로그램·회차 — D31. 원천은 DB다.
 * D31에서 둔 mock 미러는 D32(예약·회원 이관)로 마지막 독자가 사라져 없앴다 — 예약 집계도 DB에서 센다.
 */
@Injectable()
export class ProgramService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 조회 ──────────────────────────────────────────────

  async list(filter: { branchId?: string; status?: string; pricingType?: string }): Promise<ProgramView[]> {
    // 예전 mock은 모르는 값으로 거르면 빈 목록이었다 — enum 밖 값을 DB로 보내 500이 나지 않게 같은 동작을 유지한다.
    if (filter.status && !PROGRAM_STATUSES.includes(filter.status)) return [];
    if (filter.pricingType && !PRICING_TYPES.includes(filter.pricingType as MockProgram['pricingType'])) return [];
    const rows = await this.prisma.program.findMany({
      where: {
        branchId: filter.branchId,
        status: filter.status as Program['status'] | undefined,
        pricingType: filter.pricingType as Program['pricingType'] | undefined,
      },
      include: withNames,
      orderBy: { id: 'asc' },
    });
    return rows.map(toView);
  }

  async findById(id: string): Promise<MockProgram | null> {
    const row = await this.prisma.program.findUnique({ where: { id } });
    return row ? toMockProgram(row) : null;
  }

  /** 예약및결제 A-5 GET /programs/:id/slots?date= — bookedCount는 캐시 없이 유효 예약(REQUESTED/CONFIRMED)을 센다(예약및결제 A-3). */
  async listSlots(programId: string, date?: string): Promise<Array<MockScheduleSlot & { bookedCount: number }>> {
    if (date !== undefined && !DATE_RE.test(date)) return [];
    const rows = await this.prisma.scheduleSlot.findMany({
      where: { programId, date: date ? dateOf(date) : undefined },
      include: { _count: { select: { reservations: { where: { status: { in: ACTIVE } } } } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => ({ ...toMockSlot(r), bookedCount: r._count.reservations }));
  }

  /**
   * ADR-PRG-02 — 상태 전이 응답에 포함할 "오늘(KST) 이후 회차의 유효 예약" 목록. 취소·노쇼·완료 건은
   * 관리자가 조치할 대상이 아니므로 제외한다(bookedCount와 같은 유효 예약 정의).
   */
  async futureActiveReservations(programId: string): Promise<{
    count: number;
    items: Array<{ reservationId: string; memberId: string; memberName?: string; scheduleSlotId: string; date: string; startTime: string }>;
  }> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        status: { in: ACTIVE },
        scheduleSlot: { programId, date: { gte: dateOf(todayKst()) } },
      },
      include: { member: { select: { name: true } }, scheduleSlot: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const items = rows.map((r) => ({
      reservationId: r.id,
      memberId: r.memberId,
      memberName: r.member.name,
      scheduleSlotId: r.scheduleSlotId,
      date: toKstDateString(r.scheduleSlot.date),
      startTime: r.scheduleSlot.startTime,
    }));
    return { count: items.length, items };
  }

  // ── 쓰기 ──────────────────────────────────────────────

  // 강사프로그램게시 A-5 POST /programs — BRANCH_ADMIN 전용(컨트롤러에서 강제). 새 프로그램은 PREPARING으로 시작한다.
  async create(branchId: string, input: ProgramInput): Promise<ProgramView> {
    if (input.instructorId) await this.assertInstructorInBranch(input.instructorId, branchId);
    if (input.facilityId) await this.assertFacilityInBranch(input.facilityId, branchId);
    assertCapacityForPricingType(input.pricingType, input.capacity);
    const { price, capacity } = normalizePricing(input);
    const row = await this.prisma.program.create({
      data: {
        branchId,
        facilityId: input.facilityId ?? null,
        instructorId: input.instructorId ?? null,
        name: input.name,
        category: input.category,
        ageGroup: input.ageGroup,
        description: input.description,
        pricingType: input.pricingType,
        price,
        capacity: capacity ?? null,
        status: 'PREPARING',
        startDate: dateOf(input.startDate),
        endDate: input.endDate ? dateOf(input.endDate) : null,
      },
    });
    return this.afterWrite(row.id);
  }

  // 강사프로그램게시 A-5 PATCH /programs/:id — 상태는 여기서 바꿀 수 없다(상태 전이 API 전용).
  // 검증을 전부 끝낸 뒤 한 번의 update로 반영한다 — 중간 실패로 반쪽 수정이 남지 않게(예전 mock과 같은 원칙).
  async update(id: string, input: Partial<ProgramInput>): Promise<ProgramView> {
    const program = await this.requireProgram(id);
    if (input.instructorId) await this.assertInstructorInBranch(input.instructorId, program.branchId);
    if (input.facilityId) await this.assertFacilityInBranch(input.facilityId, program.branchId);
    const pricingType = input.pricingType ?? program.pricingType;
    const capacityIn = input.capacity ?? program.capacity ?? undefined;
    // ADR-PRG-01 — PAID_SESSION은 정원이 원인 시점(생성/수정)에 바로 막혀야 회차 생성 때 뒤늦게 실패하지 않는다.
    assertCapacityForPricingType(pricingType, capacityIn);
    const normalized = normalizePricing({ pricingType, price: input.price ?? program.price, capacity: capacityIn });

    const data: Prisma.ProgramUncheckedUpdateInput = {
      name: input.name,
      category: input.category,
      ageGroup: input.ageGroup,
      description: input.description,
      startDate: input.startDate !== undefined ? dateOf(input.startDate) : undefined,
      pricingType,
      price: normalized.price,
      capacity: normalized.capacity ?? null,
    };
    // 빈 문자열은 "연결 해제"(예전 mock의 `|| undefined`와 같다).
    if (input.instructorId !== undefined) data.instructorId = input.instructorId || null;
    if (input.facilityId !== undefined) data.facilityId = input.facilityId || null;
    if (input.endDate !== undefined) data.endDate = input.endDate ? dateOf(input.endDate) : null;
    await this.prisma.program.update({ where: { id }, data });
    return this.afterWrite(id);
  }

  // 강사프로그램게시 A-5 PATCH /programs/:id/status, §3-2 전이표. 표에 없는 전이(자기 자신 포함)는 409.
  // DELETE /programs/:id "삭제(소프트)"도 ENDED 전이로 이 메서드를 쓴다(architecture/entities.md D9 소프트 삭제 원칙).
  async updateStatus(id: string, status: MockProgram['status']): Promise<ProgramView> {
    const program = await this.requireProgram(id);
    if (!PROGRAM_STATUS_TRANSITIONS[program.status].includes(status)) {
      throw new AppException(
        'INVALID_STATUS_TRANSITION',
        `${program.status} 상태에서 ${status}(으)로 전이할 수 없습니다.`,
        409,
      );
    }
    // 동시에 두 전이가 들어와도 전이표를 우회하지 못하게, 읽은 상태가 그대로일 때만 바꾼다.
    const { count } = await this.prisma.program.updateMany({ where: { id, status: program.status }, data: { status } });
    if (count === 0) {
      throw new AppException('INVALID_STATUS_TRANSITION', '다른 요청이 먼저 상태를 바꿨습니다. 다시 시도하세요.', 409);
    }
    return this.afterWrite(id);
  }

  // 예약및결제 A-5 POST /programs/:id/slots — PAID_SESSION만. 정원을 비우면 프로그램 정원을 쓴다.
  async createSlot(
    programId: string,
    input: { date: string; startTime: string; endTime: string; capacity?: number },
  ): Promise<MockScheduleSlot & { bookedCount: number }> {
    const program = await this.requireProgram(programId);
    if (program.pricingType !== 'PAID_SESSION') {
      throw new AppException(
        'SLOT_NOT_APPLICABLE',
        '회차 예약형(PAID_SESSION) 프로그램에만 회차를 추가할 수 있습니다.',
        400,
      );
    }
    const capacity = input.capacity ?? program.capacity;
    if (!capacity || capacity < 1) {
      throw new AppException('INVALID_CAPACITY', '정원은 1명 이상이어야 합니다.', 400);
    }
    const row = await this.prisma.scheduleSlot.create({
      data: {
        programId,
        date: dateOf(input.date),
        startTime: input.startTime,
        endTime: input.endTime,
        capacity,
      },
    });
    return { ...toMockSlot(row), bookedCount: 0 };
  }

  // ── 내부 ──────────────────────────────────────────────

  private async requireProgram(id: string): Promise<Program> {
    const row = await this.prisma.program.findUnique({ where: { id } });
    if (!row) {
      throw new AppException('PROGRAM_NOT_FOUND', '프로그램을 찾을 수 없습니다.', 404);
    }
    return row;
  }

  // ADR-PRG-03 — 강사·시설은 프로그램과 같은 지점이어야 한다. DB 트리거(D28)가 뒤를 받치지만 앱이 먼저 400으로 알린다.
  private async assertInstructorInBranch(instructorId: string, branchId: string): Promise<void> {
    const row = await this.prisma.instructor.findUnique({ where: { id: instructorId }, select: { branchId: true } });
    if (!row || row.branchId !== branchId) {
      throw new AppException('INSTRUCTOR_BRANCH_MISMATCH', '강사는 프로그램과 같은 지점 소속이어야 합니다.', 400);
    }
  }

  private async assertFacilityInBranch(facilityId: string, branchId: string): Promise<void> {
    const row = await this.prisma.facility.findUnique({ where: { id: facilityId }, select: { branchId: true } });
    if (!row || row.branchId !== branchId) {
      throw new AppException('FACILITY_BRANCH_MISMATCH', '시설은 프로그램과 같은 지점 소속이어야 합니다.', 400);
    }
  }

  private async afterWrite(id: string): Promise<ProgramView> {
    return toView(await this.prisma.program.findUniqueOrThrow({ where: { id }, include: withNames }));
  }
}

// ADR-PRG-01 — PAID_SESSION은 정원이 예약 가능 좌석 수 그 자체라 추측해서 기본값을 넣으면 안 된다.
function assertCapacityForPricingType(pricingType: MockProgram['pricingType'], capacity?: number): void {
  if (pricingType === 'PAID_SESSION' && (capacity === undefined || capacity < 1)) {
    throw new AppException(
      'PROGRAM_CAPACITY_REQUIRED',
      'PAID_SESSION 프로그램은 정원(capacity)을 1명 이상 지정해야 합니다.',
      400,
    );
  }
}

// 강사프로그램게시 A-6 — FREE_ACCESS는 예약 개념이 없어 price·capacity를 서버에서 강제로 비운다(클라이언트 값 무시).
function normalizePricing(input: { pricingType: MockProgram['pricingType']; price: number; capacity?: number }) {
  if (input.pricingType === 'FREE_ACCESS') return { price: 0, capacity: undefined };
  return { price: input.price, capacity: input.capacity };
}

export function toMockProgram(row: Program): MockProgram {
  return {
    id: row.id,
    branchId: row.branchId,
    facilityId: row.facilityId ?? undefined,
    instructorId: row.instructorId ?? undefined,
    name: row.name,
    category: row.category,
    ageGroup: row.ageGroup,
    description: row.description ?? undefined,
    pricingType: row.pricingType,
    price: row.price,
    capacity: row.capacity ?? undefined,
    status: row.status,
    startDate: toKstDateString(row.startDate),
    endDate: row.endDate ? toKstDateString(row.endDate) : undefined,
  };
}

function toMockSlot(row: ScheduleSlot): MockScheduleSlot {
  return {
    id: row.id,
    programId: row.programId,
    date: toKstDateString(row.date),
    startTime: row.startTime,
    endTime: row.endTime,
    capacity: row.capacity,
  };
}

function toView(row: Program & { branch: { name: string }; instructor: { name: string } | null }): ProgramView {
  return { ...toMockProgram(row), branchName: row.branch.name, instructorName: row.instructor?.name };
}
