import { Injectable } from '@nestjs/common';
import { Document, DocumentCategory, Prisma } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { addYearsToDateString, todayKst, toKstDateString } from '../../common/date/kst-date';
import { PrismaService } from '../../prisma/prisma.service';
import { MockDocument } from '../../fixtures/mock-data.types';
import { BranchService } from '../branches/branch.service';

type Tx = Prisma.TransactionClient;
type DocumentRow = Document & { branch: { name: string } | null };
export type DocumentView = MockDocument & { branchName?: string; relatedStaffName?: string; uploadedByName?: string };

const CATEGORIES: DocumentCategory[] = ['CONTRACT', 'HR_RECORD', 'MANUAL', 'OTHER'];
const dateOf = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`);
const withBranch = { branch: { select: { name: true } } } as const;

export type CreateDocumentInput = {
  category: DocumentCategory;
  branchId?: string;
  relatedStaffId?: string;
  title: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
  retentionUntil?: string;
};

/**
 * 문서(자원문서관리 부록 A) — D34. 원천은 DB다. 규칙(보존기한 계산 A-6 문서, ADR-RES-01·03,
 * 소프트 삭제 D9)은 mock 구현 그대로 옮겼다. 권한·지점 강제는 컨트롤러가 한다.
 */
@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchService: BranchService,
  ) {}

  // ── 조회 ──────────────────────────────────────────────

  // BRANCH_ADMIN은 본인 지점 + 전사 문서(branchId null)만(자원문서관리 A-7).
  async list(filter: { scopeBranchId?: string; branchId?: string; category?: string }): Promise<DocumentView[]> {
    // 예전 mock은 모르는 카테고리로 거르면 빈 목록이었다 — enum 밖 값을 DB로 보내 500이 나지 않게 유지.
    if (filter.category && !CATEGORIES.includes(filter.category as DocumentCategory)) return [];
    const rows = await this.prisma.document.findMany({
      where: {
        deletedAt: null,
        AND: [
          filter.scopeBranchId ? { OR: [{ branchId: null }, { branchId: filter.scopeBranchId }] } : {},
          filter.branchId ? { branchId: filter.branchId } : {},
        ],
        category: filter.category as DocumentCategory | undefined,
      },
      include: withBranch,
      orderBy: { createdAt: 'asc' },
    });
    return this.toViews(rows);
  }

  async findById(id: string): Promise<DocumentView> {
    const row = await this.prisma.document.findFirst({ where: { id, deletedAt: null }, include: withBranch });
    if (!row) throw documentNotFound();
    return (await this.toViews([row]))[0];
  }

  // 자원문서관리 A-6(문서) — 보존기한이 지난 문서도 자동 삭제하지 않고 경고 대상으로 남긴다(법정 의무는 "최소" 보존기간).
  // 임박 기준일(오늘 KST + withinDays) 이하만 조건으로 읽는다 — mock의 전체 스캔·정렬을 없앴다(D34 결정 1).
  async retentionAlerts(withinDays = 30): Promise<DocumentView[]> {
    const limit = toKstDateString(new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000));
    const rows = await this.prisma.document.findMany({
      where: { deletedAt: null, retentionUntil: { not: null, lte: dateOf(limit) } },
      include: withBranch,
      orderBy: [{ retentionUntil: 'asc' }, { createdAt: 'asc' }],
    });
    return this.toViews(rows);
  }

  // ── 쓰기 ──────────────────────────────────────────────

  // 검사 순서는 mock 그대로(지점 없음 → 계약 종료 → HR 대상 직원 → CONTRACT 보존기한) — 에러 코드 우선순위가 테스트로 고정돼 있다.
  // ADR-RES-01 — 계약종료 지점의 신규 문서 차단. 전사 문서(branchId 없음)는 특정 지점 계약과 무관해 대상 아님.
  async create(uploadedBy: string, input: CreateDocumentInput): Promise<DocumentView> {
    if (input.branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: input.branchId }, select: { id: true } });
      if (!branch) throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
      if ((await this.branchService.loadGate()).isTerminated(input.branchId)) {
        throw new AppException('BRANCH_TERMINATED', '위탁계약이 종료된 지점에는 새 문서를 등록할 수 없습니다.', 409);
      }
    }
    let resignDate: Date | null = null;
    if (input.category === 'HR_RECORD') {
      if (!input.relatedStaffId) {
        throw new AppException('STAFF_REQUIRED', '인사서류는 대상 직원을 지정해야 합니다.', 400);
      }
      const staff = await this.prisma.staff.findUnique({ where: { id: input.relatedStaffId }, select: { resignDate: true } });
      if (!staff) throw new AppException('STAFF_NOT_FOUND', '직원을 찾을 수 없습니다.', 404);
      resignDate = staff.resignDate;
    }
    // ADR-RES-03 — CONTRACT는 자동계산이 없어 미입력을 허용하면 조용히 "영구 보관"이 된다.
    if (input.category === 'CONTRACT' && !input.retentionUntil) {
      throw new AppException('RETENTION_UNTIL_REQUIRED', '계약서 문서는 보존기한을 직접 입력해야 합니다.', 400);
    }
    const row = await this.prisma.document.create({
      data: {
        category: input.category,
        branchId: input.branchId ?? null,
        relatedStaffId: input.category === 'HR_RECORD' ? input.relatedStaffId : null,
        title: input.title,
        fileUrl: input.fileUrl,
        fileType: input.fileType,
        fileSize: input.fileSize,
        uploadedBy,
        retentionUntil: retentionUntil(input.category, resignDate, input.retentionUntil),
      },
      include: withBranch,
    });
    return (await this.toViews([row]))[0];
  }

  // D9 소프트 삭제 — 계약·인사 분쟁 시 감사 목적으로 복구 가능해야 한다.
  async softDelete(id: string): Promise<void> {
    const { count } = await this.prisma.document.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw documentNotFound();
  }

  // ── 응답 형식 ──────────────────────────────────────────

  // 관련 직원·업로더 이름은 id 묶음 조회 한 번씩으로 붙인다(목록 N+1 제거, D34 결정 1).
  // Document에는 두 컬럼의 외래키가 없어 조인 대신 묶음 조회를 쓴다(D34 "감수하는 것").
  private async toViews(rows: DocumentRow[]): Promise<DocumentView[]> {
    const staffIds = [...new Set(rows.map((r) => r.relatedStaffId).filter((x): x is string => !!x))];
    const accountIds = [...new Set(rows.map((r) => r.uploadedBy))];
    const [staff, accounts] = await Promise.all([
      staffIds.length ? this.prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } }) : [],
      this.prisma.account.findMany({ where: { id: { in: accountIds } }, select: { id: true, name: true } }),
    ]);
    const staffName = new Map(staff.map((s) => [s.id, s.name]));
    const accountName = new Map(accounts.map((a) => [a.id, a.name]));
    return rows.map((r) => ({
      ...toMockDocument(r),
      branchName: r.branch?.name,
      relatedStaffName: r.relatedStaffId ? staffName.get(r.relatedStaffId) : undefined,
      uploadedByName: accountName.get(r.uploadedBy),
    }));
  }
}

/**
 * ADR-RES-02 — 퇴사 시 그 직원의 미삭제 HR_RECORD 보존기한을 퇴사일+3년으로 다시 계산한다.
 * StaffService.resign이 퇴사 트랜잭션 안에서 부른다(D34 결정 2 — 두 저장소로 나뉘어 있던 부수효과를 한 트랜잭션으로).
 */
export async function recalculateHrRetention(tx: Tx, staffId: string, resignDate: string): Promise<number> {
  const { count } = await tx.document.updateMany({
    where: { category: 'HR_RECORD', relatedStaffId: staffId, deletedAt: null },
    data: { retentionUntil: dateOf(addYearsToDateString(resignDate, 3)) },
  });
  return count;
}

// 자원문서관리 A-6 — HR_RECORD는 근로관계 종료일(없으면 업로드일=오늘 KST)+3년, CONTRACT는 직접 입력, 나머지는 영구 보관.
function retentionUntil(category: DocumentCategory, resignDate: Date | null, manual?: string): Date | null {
  if (category === 'CONTRACT') return manual ? dateOf(manual) : null;
  if (category === 'HR_RECORD') {
    const base = resignDate ? toKstDateString(resignDate) : todayKst();
    return dateOf(addYearsToDateString(base, 3));
  }
  return null;
}

function documentNotFound() {
  return new AppException('DOCUMENT_NOT_FOUND', '문서를 찾을 수 없습니다.', 404);
}

function toMockDocument(r: Document): MockDocument {
  return {
    id: r.id,
    category: r.category,
    branchId: r.branchId ?? undefined,
    relatedStaffId: r.relatedStaffId ?? undefined,
    title: r.title,
    fileUrl: r.fileUrl,
    fileType: r.fileType ?? undefined,
    fileSize: r.fileSize ?? undefined,
    uploadedBy: r.uploadedBy,
    retentionUntil: r.retentionUntil ? toKstDateString(r.retentionUntil) : undefined,
    createdAt: r.createdAt.toISOString(),
    deletedAt: r.deletedAt?.toISOString(),
  };
}
