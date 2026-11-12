import { Injectable } from '@nestjs/common';
import { Document, DocumentCategory, Prisma } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { addYearsToDateString, todayKst, toKstDateString } from '../../common/date/kst-date';
import { lockBranchForShare } from '../../prisma/integrity';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentResponse } from '../../common/api-response.types';
import { PageRequest, SortDir, searchTerm } from '../../common/http/pagination';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { recordAudit } from '../../prisma/audit';
import { VerifiedStoredFile, requestStoredUpload, verifyStoredFile } from '../posts/attachment-rules';
import { StorageService } from '../storage/storage.service';

type Tx = Prisma.TransactionClient;
type DocumentRow = Document & { branch: { name: string } | null };
export type DocumentView = DocumentResponse & { branchName?: string; relatedStaffName?: string; uploadedByName?: string };

const CATEGORIES: DocumentCategory[] = ['HR_RECORD', 'MANUAL', 'OTHER'];
const dateOf = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00Z`);
const withBranch = { branch: { select: { name: true } } } as const;

// D69 2차(log/206) — 새 문서는 저장소에 올린 파일(file), 옛 방식 주소(fileUrl)는 시드·이관용으로만 남는다. 둘 중 정확히 하나.
export type CreateDocumentInput = {
  category: DocumentCategory;
  branchId?: string;
  relatedStaffId?: string;
  title: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
  file?: VerifiedStoredFile;
};

// D74 2차(log/206) — 문서 목록 머리글 정렬 열(화면 표와 같다).
export const DOCUMENT_SORT_KEYS = ['title', 'category', 'branch', 'relatedStaff', 'retentionUntil', 'uploader', 'createdAt'] as const;
export type DocumentSortKey = (typeof DOCUMENT_SORT_KEYS)[number];
const DOCUMENT_SORT: Record<DocumentSortKey, (dir: SortDir) => Prisma.DocumentOrderByWithRelationInput> = {
  title: (dir) => ({ title: dir }),
  category: (dir) => ({ category: dir }),
  branch: (dir) => ({ branch: { name: dir } }),
  relatedStaff: (dir) => ({ relatedStaff: { name: dir } }),
  retentionUntil: (dir) => ({ retentionUntil: { sort: dir, nulls: 'last' } }),
  uploader: (dir) => ({ uploader: { name: dir } }),
  createdAt: (dir) => ({ createdAt: dir }),
};

/**
 * 문서(자원문서관리 부록 A) — D34. 원천은 DB다. 규칙(보존기한 계산 A-6 문서, ADR-RES-01·03,
 * 소프트 삭제 D9)은 mock 구현 그대로 옮겼다. 권한·지점 강제는 컨트롤러가 한다.
 */
@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ── 조회 ──────────────────────────────────────────────

  // BRANCH_ADMIN은 본인 지점 + 전사 문서(branchId null)만(자원문서관리 A-7).
  // D43 — 쌓이는 목록이라 서버 쪽 나누기(D74 2차, log/206). 검색어는 제목·대상 직원 이름, 기본 순서는 최근 등록부터.
  async list(
    filter: { scopeBranchId?: string; branchId?: string; category?: string; relatedStaffId?: string; q?: string },
    page: PageRequest,
    sort?: { key: DocumentSortKey; dir: SortDir },
  ): Promise<{ items: DocumentView[]; total: number }> {
    // 예전 mock은 모르는 카테고리로 거르면 빈 목록이었다 — enum 밖 값을 DB로 보내 500이 나지 않게 유지.
    if (filter.category && !CATEGORIES.includes(filter.category as DocumentCategory)) return { items: [], total: 0 };
    const q = searchTerm(filter.q);
    const where: Prisma.DocumentWhereInput = {
      deletedAt: null,
      AND: [
        filter.scopeBranchId ? { OR: [{ branchId: null }, { branchId: filter.scopeBranchId }] } : {},
        filter.branchId ? { branchId: filter.branchId } : {},
        q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { relatedStaff: { name: { contains: q, mode: 'insensitive' } } }] } : {},
      ],
      category: filter.category as DocumentCategory | undefined,
      relatedStaffId: filter.relatedStaffId,
    };
    const [total, rows] = await Promise.all([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({
        where,
        include: withBranch,
        orderBy: sort ? [DOCUMENT_SORT[sort.key](sort.dir), { id: sort.dir }] : [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: page.skip,
        take: page.pageSize,
      }),
    ]);
    return { items: await this.toViews(rows), total };
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

  // 검사 순서는 mock 그대로(지점 없음 → 계약 종료 → HR 대상 직원) — 에러 코드 우선순위가 테스트로 고정돼 있다.
  // D69 — 계약서 분류(ADR-RES-03 보존기한 직접 입력)는 없앴다. 계약서는 계약 회차에서 다룬다.
  // ADR-RES-01 — 계약종료 지점의 신규 문서 차단. 전사 문서(branchId 없음)는 특정 지점 계약과 무관해 대상 아님.
  // D70 — 종료 판정은 쓰기 트랜잭션 안에서 지점 행 공유 락으로(종료 확정과 직렬화).
  async create(uploadedBy: string, input: CreateDocumentInput): Promise<DocumentView> {
    const row = await this.prisma
      .$transaction(async (tx) => {
      if (input.branchId) {
        const branch = await lockBranchForShare(tx, input.branchId);
        if (!branch) throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
        if (branch.contractStatus === 'TERMINATED') {
          throw new AppException('BRANCH_TERMINATED', '위탁계약이 종료된 지점에는 새 문서를 등록할 수 없습니다.', 409);
        }
      }
      let resignDate: Date | null = null;
      if (input.category === 'HR_RECORD') {
        if (!input.relatedStaffId) {
          throw new AppException('STAFF_REQUIRED', '인사서류는 대상 직원을 지정해야 합니다.', 400);
        }
        const staff = await tx.staff.findUnique({ where: { id: input.relatedStaffId }, select: { resignDate: true } });
        if (!staff) throw new AppException('STAFF_NOT_FOUND', '직원을 찾을 수 없습니다.', 404);
        resignDate = staff.resignDate;
      }
      return tx.document.create({
        data: {
          category: input.category,
          branchId: input.branchId ?? null,
          relatedStaffId: input.category === 'HR_RECORD' ? input.relatedStaffId : null,
          title: input.title,
          ...(input.file
            ? {
                storagePath: input.file.path,
                fileName: input.file.fileName,
                fileType: input.file.fileType,
                fileSize: input.file.fileSize,
              }
            : { fileUrl: input.fileUrl, fileType: input.fileType, fileSize: input.fileSize }),
          uploadedBy,
          retentionUntil: retentionUntil(input.category, resignDate),
        },
        include: withBranch,
      });
      })
      .catch((e: unknown) => {
        // 같은 저장소 경로를 두 번 붙이면 unique(storagePath) 위반 — 계약 파일과 같은 409.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new AppException('ATTACHMENT_DUPLICATE', '이미 붙인 파일입니다. 다시 올려 주세요.', 409);
        }
        throw e;
      });
    return (await this.toViews([row]))[0];
  }

  // ── 파일(D69 2차, log/206) ─────────────────────────────

  /** 1회용 업로드 URL — 경로는 문서 전용(`documents/`). 형식·한도는 게시판 첨부와 같다(D57). */
  async requestUpload(input: { fileName: string; fileType: string; fileSize: number }) {
    return requestStoredUpload(this.storage, 'documents', input);
  }

  /** 올라온 파일을 저장소에서 다시 확인한다(크기·형식). 트랜잭션 밖에서 부른다. */
  async verifyFile(input: { path: string; fileName: string }): Promise<VerifiedStoredFile> {
    return verifyStoredFile(this.storage, 'documents', input);
  }

  /**
   * 문서 열기 — 열 때마다 열람 기록(D69 결정 8과 같은 방식, 사용자 결정 "문서도 열 때 열람 기록").
   * 올린 파일은 60초 다운로드 URL, 옛 주소 문서는 그 주소를 그대로(외부 링크) 돌려준다.
   */
  async open(id: string, viewer: RequestUser): Promise<{ url: string; expiresInSec: number | null; external: boolean }> {
    const doc = await this.prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!doc) throw documentNotFound();
    // 시연 데이터의 옛 문서는 `demo://` 같은 가짜 주소다 — 열 수 없으니 기록도 남기지 않고 409로 알린다(http(s)만 연다, log/139).
    if (!doc.storagePath && !/^https?:\/\//i.test(doc.fileUrl ?? '')) {
      throw new AppException('DOCUMENT_FILE_UNAVAILABLE', '파일 없이 등록된 옛 문서라 열 수 없습니다. 파일을 올려 새로 등록하세요.', 409);
    }
    await recordAudit(this.prisma, {
      actorId: viewer.accountId,
      entity: 'Document',
      entityId: doc.id,
      action: 'DOCUMENT_FILE_VIEWED',
      after: { title: doc.title, fileName: doc.fileName ?? undefined, external: doc.storagePath === null },
    });
    if (doc.storagePath) {
      const name = doc.fileName ?? `${doc.title}.${doc.storagePath.split('.').pop()}`;
      return { url: await this.storage.createDownloadUrl(doc.storagePath, name, 60), expiresInSec: 60, external: false };
    }
    return { url: doc.fileUrl!, expiresInSec: null, external: true };
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
      ...toDocumentResponse(r),
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

// 자원문서관리 A-6 — HR_RECORD는 근로관계 종료일(없으면 업로드일=오늘 KST)+3년, 나머지는 영구 보관.
function retentionUntil(category: DocumentCategory, resignDate: Date | null): Date | null {
  if (category === 'HR_RECORD') {
    const base = resignDate ? toKstDateString(resignDate) : todayKst();
    return dateOf(addYearsToDateString(base, 3));
  }
  return null;
}

function documentNotFound() {
  return new AppException('DOCUMENT_NOT_FOUND', '문서를 찾을 수 없습니다.', 404);
}

function toDocumentResponse(r: Document): DocumentResponse {
  return {
    id: r.id,
    category: r.category,
    branchId: r.branchId ?? undefined,
    relatedStaffId: r.relatedStaffId ?? undefined,
    title: r.title,
    fileUrl: r.fileUrl ?? undefined,
    fileName: r.fileName ?? undefined,
    stored: r.storagePath !== null,
    fileType: r.fileType ?? undefined,
    fileSize: r.fileSize ?? undefined,
    uploadedBy: r.uploadedBy,
    retentionUntil: r.retentionUntil ? toKstDateString(r.retentionUntil) : undefined,
    createdAt: r.createdAt.toISOString(),
    deletedAt: r.deletedAt?.toISOString(),
  };
}
