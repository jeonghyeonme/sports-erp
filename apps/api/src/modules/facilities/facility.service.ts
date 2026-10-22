import { Injectable } from '@nestjs/common';
import { Facility } from '@prisma/client';
import { FacilityType, MockFacility } from '../../fixtures/mock-data.types';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchService } from '../branches/branch.service';
import { kstHoursMinutes, toKstDateString } from '../../common/date/kst-date';

// ADR-FAC-05 — 혼잡도 = 지금 진행 중인 회차의 예약 인원(자동) + 예약 외 현장 인원(currentCount, 관리자 입력).
// reservedCount·totalCount는 조회할 때 계산하고, level은 totalCount 기준으로 다시 매긴다(저장된 level은 쓰지 않는다).
export type FacilityView = MockFacility & { branchName?: string; reservedCount: number; totalCount: number };

/**
 * 시설·혼잡도 — D31. 원천은 DB다.
 * D31에서 둔 mock 미러는 D32로 마지막 독자가 사라져 없앴다.
 */
@Injectable()
export class FacilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchService: BranchService,
  ) {}

  // ADR-FAC-02 — 운영 중단(isActive=false)된 시설은 기본 목록에서 제외한다.
  async list(filter: { branchId?: string; isActive: boolean }): Promise<FacilityView[]> {
    const rows = await this.prisma.facility.findMany({
      where: { branchId: filter.branchId, isActive: filter.isActive },
      include: { branch: { select: { name: true } } },
      orderBy: { id: 'asc' },
    });
    const reserved = await this.reservedCounts(rows.map((r) => r.id), new Date());
    return rows.map((r) => withOccupancy({ ...toMockFacility(r), branchName: r.branch.name }, reserved.get(r.id) ?? 0));
  }

  /**
   * ADR-FAC-05 — 시설별 "지금 진행 중인 회차"(오늘 KST, 시작 ≤ 지금 < 끝)의 확정·체크인 예약 수.
   * 결제 대기(REQUESTED)는 아직 자리가 확정되지 않았고, 취소·노쇼는 시설에 없으므로 세지 않는다.
   * 회차 시각은 'HH:MM' 문자열이라 같은 형식으로 비교한다(0을 채운 24시간제 — 문자열 순서 = 시각 순서).
   * 조회 한 번에 쿼리 하나 — 회원 웹 방문당 호출 수(design-constants ⑩)를 늘리지 않는다.
   */
  private async reservedCounts(facilityIds: string[], now: Date): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (facilityIds.length === 0) return counts;
    const { hours, minutes } = kstHoursMinutes(now);
    const hhmm = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const slots = await this.prisma.scheduleSlot.findMany({
      where: {
        date: new Date(`${toKstDateString(now)}T00:00:00Z`),
        startTime: { lte: hhmm },
        endTime: { gt: hhmm },
        program: { facilityId: { in: facilityIds } },
      },
      select: {
        program: { select: { facilityId: true } },
        _count: { select: { reservations: { where: { status: { in: ['CONFIRMED', 'COMPLETED'] } } } } },
      },
    });
    for (const slot of slots) {
      const facilityId = slot.program.facilityId!;
      counts.set(facilityId, (counts.get(facilityId) ?? 0) + slot._count.reservations);
    }
    return counts;
  }

  async findById(id: string): Promise<MockFacility | null> {
    const row = await this.prisma.facility.findUnique({ where: { id } });
    return row ? toMockFacility(row) : null;
  }

  // 혼잡도관리 A-5 POST /facilities — capacity 1 이상 필수(혼잡도관리 A-6 나눗셈 오류 방지).
  // ADR-FAC-03 — 계약종료(TERMINATED) 지점의 신규 시설 등록 차단. 기존 시설 정정(update)은 대상 아님.
  async create(branchId: string, input: { name: string; type: FacilityType; capacity: number }): Promise<FacilityView> {
    const gate = await this.branchService.loadGate();
    if (gate.isTerminated(branchId)) {
      throw new AppException('BRANCH_TERMINATED', '위탁계약이 종료된 지점에는 새 시설을 등록할 수 없습니다.', 409);
    }
    if (input.capacity < 1) {
      throw new AppException('INVALID_CAPACITY', '정원은 1명 이상이어야 합니다.', 400);
    }
    const row = await this.prisma.facility.create({
      data: {
        branchId,
        name: input.name,
        type: input.type,
        capacity: input.capacity,
        currentCount: 0,
        level: 1,
        lastUpdatedAt: new Date(),
      },
    });
    return this.afterWrite(row.id);
  }

  // 혼잡도관리 A-5 PATCH /facilities/:id — 정원이 바뀌면 현재 인원 대비 혼잡도 단계를 즉시 재계산한다.
  // ADR-FAC-02 — isActive 토글(비활성화·재활성화)도 이 경로로 처리한다.
  async update(
    id: string,
    input: Partial<{ name: string; type: FacilityType; capacity: number; isActive: boolean }>,
  ): Promise<FacilityView> {
    const facility = await this.requireFacility(id);
    if (input.capacity !== undefined && input.capacity < 1) {
      throw new AppException('INVALID_CAPACITY', '정원은 1명 이상이어야 합니다.', 400);
    }
    await this.prisma.facility.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        capacity: input.capacity,
        level: input.capacity !== undefined ? congestionLevel(facility.currentCount, input.capacity) : undefined,
        isActive: input.isActive,
      },
    });
    return this.afterWrite(id);
  }

  // 혼잡도관리 A-5 POST /facilities/:id/congestion/manual — ADR-FAC-05부터 "예약 외 현장 인원" 입력이다(예약 인원은
  // 조회 때 더한다). CongestionSnapshot 이력 없이 Facility.currentCount를 덮어쓴다.
  // ADR-FAC-03 — 계약종료 지점의 신규 혼잡도 보정 차단. ADR-FAC-01 — 보정 시각을 lastUpdatedAt에 남긴다.
  async setManualCongestion(id: string, currentCount: number): Promise<FacilityView> {
    const facility = await this.requireFacility(id);
    const gate = await this.branchService.loadGate();
    if (gate.isTerminated(facility.branchId)) {
      throw new AppException('BRANCH_TERMINATED', '위탁계약이 종료된 지점의 혼잡도는 보정할 수 없습니다.', 409);
    }
    if (currentCount < 0) {
      throw new AppException('INVALID_CURRENT_COUNT', '현장 인원은 0명 이상이어야 합니다.', 400);
    }
    await this.prisma.facility.update({
      where: { id },
      data: { currentCount, level: congestionLevel(currentCount, facility.capacity), lastUpdatedAt: new Date() },
    });
    return this.afterWrite(id);
  }

  private async requireFacility(id: string): Promise<Facility> {
    const row = await this.prisma.facility.findUnique({ where: { id } });
    if (!row) {
      throw new AppException('FACILITY_NOT_FOUND', '시설을 찾을 수 없습니다.', 404);
    }
    return row;
  }

  /** 커밋된 행을 다시 읽어 API 응답 형태로 돌려준다. */
  private async afterWrite(id: string): Promise<FacilityView> {
    const row = await this.prisma.facility.findUniqueOrThrow({
      where: { id },
      include: { branch: { select: { name: true } } },
    });
    const reserved = await this.reservedCounts([row.id], new Date());
    return withOccupancy({ ...toMockFacility(row), branchName: row.branch.name }, reserved.get(row.id) ?? 0);
  }
}

// ADR-FAC-05 — 예약 인원과 현장 인원(currentCount)을 더해 단계를 다시 매긴다.
function withOccupancy(view: Omit<FacilityView, 'reservedCount' | 'totalCount'>, reservedCount: number): FacilityView {
  const totalCount = reservedCount + view.currentCount;
  return { ...view, reservedCount, totalCount, level: congestionLevel(totalCount, view.capacity) };
}

// 혼잡도관리 A-6 5단계 매핑 — 응답은 예약+현장 합계로(ADR-FAC-05), 저장 칸은 현장 입력값으로 매긴다(호환용).
function congestionLevel(currentCount: number, capacity: number): number {
  const ratio = (currentCount / capacity) * 100;
  if (ratio <= 20) return 1;
  if (ratio <= 40) return 2;
  if (ratio <= 60) return 3;
  if (ratio <= 80) return 4;
  return 5;
}

function toMockFacility(row: Facility): MockFacility {
  return {
    id: row.id,
    branchId: row.branchId,
    name: row.name,
    type: row.type,
    capacity: row.capacity,
    currentCount: row.currentCount,
    level: row.level,
    lastUpdatedAt: (row.lastUpdatedAt ?? new Date(0)).toISOString(),
    isActive: row.isActive,
  };
}
