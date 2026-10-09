import { Injectable } from '@nestjs/common';
import { Asset, AssetCategory, AssetStatus, AssetType, Prisma } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { toKstDateString } from '../../common/date/kst-date';
import { PageRequest } from '../../common/http/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { allocateBranchCode } from '../../prisma/integrity';
import { MockAsset } from '../../fixtures/mock-data.types';
import { BranchService } from '../branches/branch.service';

type AssetRow = Asset & { branch: { name: string } };
export type AssetView = MockAsset & { branchName: string };

const CATEGORIES: AssetCategory[] = ['EXERCISE_EQUIPMENT', 'SAFETY_EQUIPMENT', 'OFFICE_FURNITURE', 'OTHER'];
const STATUSES: AssetStatus[] = ['NORMAL', 'REPAIRING', 'DISPOSAL_PENDING', 'DISPOSED'];
const TYPES: AssetType[] = ['FIXED_ASSET', 'CONSUMABLE'];
const withBranch = { branch: { select: { name: true } } } as const;

// 자원문서관리 A-4 "정상→수리중→폐기대상→폐기됨". 되돌림(수리 완료·폐기 보류)은 허용하되 폐기됨은 종결(RES-T02).
const STATUS_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
  NORMAL: ['REPAIRING', 'DISPOSAL_PENDING'],
  REPAIRING: ['NORMAL', 'DISPOSAL_PENDING'],
  DISPOSAL_PENDING: ['NORMAL', 'DISPOSED'],
  DISPOSED: [],
};

export type CreateAssetInput = {
  branchId: string;
  name: string;
  category: AssetCategory;
  acquiredAt: string;
  acquisitionCost: number;
  assetType?: AssetType;
  usefulLifeYears?: number;
  quantity?: number;
  location?: string;
  note?: string;
};

export type UpdateAssetInput = Partial<{ name: string; location: string; quantity: number; note: string; usefulLifeYears: number }>;

/**
 * 자산(자원문서관리 부록 A) — D35. 원천은 DB다. 규칙(자동 판정 RES-T01, 고정자산 수량 1 RES-T03,
 * 상태 전이 RES-T02, 계약 종료 차단 ADR-RES-01)은 mock 구현 그대로 옮겼다. 권한·지점 강제는 컨트롤러가 한다.
 */
@Injectable()
export class AssetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchService: BranchService,
  ) {}

  // 지점 이름은 조인으로(목록 N+1 제거, D35 결정 1).
  /**
   * D43 — 쪽 단위 + total. 상태를 지정하지 않으면 폐기(DISPOSED)는 뺀다(B8 사용자 결정, log/088) — 폐기 자산은
   * status=DISPOSED로 따로 본다. 이 기본 목록의 total이 곧 "미처리 자산 수"다(ADR-RES-01 계약 종료 경고).
   */
  async list(
    filter: { branchId?: string; category?: string; status?: string; assetType?: string },
    page: PageRequest,
  ): Promise<{ items: AssetView[]; total: number }> {
    const empty = { items: [], total: 0 };
    // 예전 mock은 모르는 값으로 거르면 빈 목록이었다 — enum 밖 값을 DB로 보내 500이 나지 않게 유지.
    if (filter.category && !CATEGORIES.includes(filter.category as AssetCategory)) return empty;
    if (filter.status && !STATUSES.includes(filter.status as AssetStatus)) return empty;
    if (filter.assetType && !TYPES.includes(filter.assetType as AssetType)) return empty;
    const where: Prisma.AssetWhereInput = {
      branchId: filter.branchId,
      category: filter.category as AssetCategory | undefined,
      status: filter.status ? (filter.status as AssetStatus) : { not: 'DISPOSED' },
      assetType: filter.assetType as AssetType | undefined,
    };
    const [total, rows] = await Promise.all([
      this.prisma.asset.count({ where }),
      this.prisma.asset.findMany({
        where,
        include: withBranch,
        orderBy: [{ assetCode: 'asc' }, { id: 'asc' }],
        skip: page.skip,
        take: page.pageSize,
      }),
    ]);
    return { items: rows.map(toView), total };
  }

  async findById(id: string): Promise<AssetView> {
    const row = await this.prisma.asset.findUnique({ where: { id }, include: withBranch });
    if (!row) throw assetNotFound();
    return toView(row);
  }

  // 검사 순서는 mock 그대로(지점 없음 → 계약 종료). ADR-RES-01 — 자산은 본사도 직접 만들 수 있어 역할 분기 없이 대상 지점으로 판정.
  // 자산번호는 D28 헬퍼로 채번(RES-T04, D35 결정 1) — 시퀀스는 증가만 해서 폐기 자산 번호도 재사용하지 않는다.
  async create(input: CreateAssetInput): Promise<AssetView> {
    const branch = await this.prisma.branch.findUnique({ where: { id: input.branchId }, select: { id: true, code: true } });
    if (!branch) throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
    if ((await this.branchService.loadGate()).isTerminated(input.branchId)) {
      throw new AppException('BRANCH_TERMINATED', '위탁계약이 종료된 지점에는 새 자산을 등록할 수 없습니다.', 409);
    }
    // 자동 판정 결과를 관리자가 수동으로 덮어쓸 수 있다(고가 소모품을 고정자산 취급하는 경우 등).
    const assetType = input.assetType ?? classifyAssetType(input.acquisitionCost);
    const row = await this.prisma.$transaction(async (tx) =>
      tx.asset.create({
        data: {
          assetCode: await allocateBranchCode(tx, branch, 'ASSET'),
          branchId: input.branchId,
          name: input.name,
          category: input.category,
          assetType,
          acquiredAt: new Date(`${input.acquiredAt.slice(0, 10)}T00:00:00Z`),
          acquisitionCost: input.acquisitionCost,
          usefulLifeYears: assetType === 'FIXED_ASSET' ? input.usefulLifeYears : null,
          status: 'NORMAL',
          quantity: assetType === 'FIXED_ASSET' ? 1 : (input.quantity ?? 1),
          location: input.location,
          note: input.note,
        },
        include: withBranch,
      }),
    );
    return toView(row);
  }

  // 이름·위치·수량·메모·내용연수만 — 상태 전이는 별도 메서드(자원문서관리 A-5). 고정자산 수량 1은 앱 검사 + D28 CHECK.
  async update(id: string, input: UpdateAssetInput): Promise<AssetView> {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw assetNotFound();
    if (input.quantity !== undefined && asset.assetType === 'FIXED_ASSET' && input.quantity !== 1) {
      throw new AppException('INVALID_QUANTITY', '고정자산은 개체 단위 관리라 수량이 항상 1입니다.', 400);
    }
    const row = await this.prisma.asset.update({
      where: { id },
      data: {
        name: input.name,
        // 빈 문자열은 "지움"(mock의 `|| undefined`와 같은 의미)
        location: input.location !== undefined ? input.location || null : undefined,
        note: input.note !== undefined ? input.note || null : undefined,
        usefulLifeYears: input.usefulLifeYears !== undefined && asset.assetType === 'FIXED_ASSET' ? input.usefulLifeYears : undefined,
        quantity: input.quantity,
      },
      include: withBranch,
    });
    return toView(row);
  }

  // 전이표 검사는 앱에서, 쓰기는 "읽은 상태 그대로일 때만"(D35 결정 2) — 동시 전이 중 하나는 409.
  async updateStatus(id: string, status: AssetStatus): Promise<AssetView> {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw assetNotFound();
    if (!STATUS_TRANSITIONS[asset.status].includes(status)) throw invalidTransition(asset.status, status);
    const { count } = await this.prisma.asset.updateMany({ where: { id, status: asset.status }, data: { status } });
    if (count === 0) {
      const current = await this.prisma.asset.findUniqueOrThrow({ where: { id } });
      throw invalidTransition(current.status, status);
    }
    return this.findById(id);
  }
}

// 자원문서관리 A-6 — 취득가액 100만원 초과면 고정자산, 이하면 소모품(세법상 즉시비용 처리 기준, RES-T01).
function classifyAssetType(acquisitionCost: number): AssetType {
  return acquisitionCost > 1_000_000 ? 'FIXED_ASSET' : 'CONSUMABLE';
}

function assetNotFound() {
  return new AppException('ASSET_NOT_FOUND', '자산을 찾을 수 없습니다.', 404);
}

function invalidTransition(from: AssetStatus, to: AssetStatus) {
  return new AppException('INVALID_STATUS_TRANSITION', `${from} 상태에서 ${to}(으)로 전이할 수 없습니다.`, 409);
}

function toView(r: AssetRow): AssetView {
  return {
    id: r.id,
    assetCode: r.assetCode,
    branchId: r.branchId,
    name: r.name,
    category: r.category,
    assetType: r.assetType,
    acquiredAt: toKstDateString(r.acquiredAt),
    acquisitionCost: r.acquisitionCost,
    usefulLifeYears: r.usefulLifeYears ?? undefined,
    status: r.status,
    quantity: r.quantity,
    location: r.location ?? undefined,
    note: r.note ?? undefined,
    branchName: r.branch.name,
  };
}
