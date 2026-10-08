import { Injectable } from '@nestjs/common';
import { Facility } from '@prisma/client';
import { FacilityType, MockFacility } from '../../fixtures/mock-data.types';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { BranchService } from '../branches/branch.service';

export type FacilityView = MockFacility & { branchName?: string };

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
    return rows.map((r) => ({ ...toMockFacility(r), branchName: r.branch.name }));
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

  // 혼잡도관리 A-5 POST /facilities/:id/congestion/manual, 혼잡도관리 A-6 "수동 보정"(source=MANUAL) — Phase 1 범위라
  // CongestionSnapshot 이력 없이 Facility.currentCount/level을 직접 덮어쓴다.
  // ADR-FAC-03 — 계약종료 지점의 신규 혼잡도 보정 차단. ADR-FAC-01 — 보정 시각을 lastUpdatedAt에 남긴다.
  async setManualCongestion(id: string, currentCount: number): Promise<FacilityView> {
    const facility = await this.requireFacility(id);
    const gate = await this.branchService.loadGate();
    if (gate.isTerminated(facility.branchId)) {
      throw new AppException('BRANCH_TERMINATED', '위탁계약이 종료된 지점의 혼잡도는 보정할 수 없습니다.', 409);
    }
    if (currentCount < 0) {
      throw new AppException('INVALID_CURRENT_COUNT', '현재 인원은 0명 이상이어야 합니다.', 400);
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
    return { ...toMockFacility(row), branchName: row.branch.name };
  }
}

// 혼잡도관리 A-6 5단계 매핑 — 수동 보정이든 정원 변경이든 currentCount/capacity 비율이 바뀔 때마다 재계산한다.
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
