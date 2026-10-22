import { Injectable } from '@nestjs/common';
import { Post, PostCategory, PostScope, Prisma } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { todayKst, toKstDateString } from '../../common/date/kst-date';
import { PrismaService } from '../../prisma/prisma.service';
import { MockPost } from '../../fixtures/mock-data.types';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { BranchService } from '../branches/branch.service';
import { hasText, sanitizePostContent } from './post-content';

type PostRow = Post & { branch: { name: string } | null; author: { name: string }; facility: { name: string } | null };
export type PostView = MockPost & { authorName?: string; branchName?: string; facilityName?: string };

const SCOPES: PostScope[] = ['HQ_TO_BRANCH', 'BRANCH_TO_MEMBER'];
const CATEGORIES: PostCategory[] = ['NOTICE', 'TRAINING_MATERIAL', 'EVENT', 'OTHER'];
// 작성자 이름도 같은 작업에서 읽는다(Post.author 관계, log/093) — 따로 조회하면 작업이 하나 늘어 순차 왕복이 는다(log/102).
const withBranch = {
  branch: { select: { name: true } },
  author: { select: { name: true } },
  facility: { select: { name: true } },
} as const;

/**
 * 게시판(게시판 문서) — D36. 원천은 DB다. 가시성(ADR-BRD-01)·페이지네이션(ADR-BRD-02)·
 * 작성 범위(§5)·계약 종료 차단(architecture/entities.md §2-1)은 mock 구현 그대로 옮겼고, 가시성은 where 조건으로 내렸다(D36 결정 1).
 */
@Injectable()
export class PostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchService: BranchService,
  ) {}

  // ADR-BRD-01 — 본사는 전부, 그 외는 전사 공지 + 자기 지점 글, 회원은 회원 비노출 본사 공지 제외.
  private visibleWhere(user: RequestUser): Prisma.PostWhereInput {
    if (user.role === 'SUPER_ADMIN') return {};
    const branchScope: Prisma.PostWhereInput = {
      OR: [{ branchId: null }, ...(user.branchId ? [{ branchId: user.branchId }] : [])],
    };
    if (user.role !== 'MEMBER') return branchScope;
    return { AND: [branchScope, { NOT: { scope: 'HQ_TO_BRANCH', visibleToMember: false } }] };
  }

  // ADR-BRD-02 — 걸러낸 뒤 자르는 것이 아니라 조건 그대로 count + skip/take(D36 결정 1). 순서는 mock처럼 등록순.
  async list(
    user: RequestUser,
    filter: { scope?: string; category?: string; facilityId?: string; page: number; pageSize: number; latestFirst?: boolean },
  ) {
    // 예전 mock은 모르는 scope로 거르면 빈 목록이었다 — enum 밖 값을 DB로 보내 500이 나지 않게 유지.
    if (filter.scope && !SCOPES.includes(filter.scope as PostScope)) {
      return { items: [] as PostView[], total: 0 };
    }
    // 분류도 같은 규칙 — 모르는 값은 빈 목록(enum 밖 값을 DB로 보내지 않는다).
    if (filter.category && !CATEGORIES.includes(filter.category as PostCategory)) {
      return { items: [] as PostView[], total: 0 };
    }
    const where: Prisma.PostWhereInput = {
      AND: [
        { deletedAt: null },
        filter.scope ? { scope: filter.scope as PostScope } : {},
        filter.category ? { category: filter.category as PostCategory } : {},
        // ADR-BRD-05 — 시설별 공지만. 보이는 글 안에서만 거르므로 남의 지점 시설 id를 줘도 빈 목록이다.
        filter.facilityId ? { facilityId: filter.facilityId } : {},
        this.visibleWhere(user),
      ],
    };
    const [total, rows] = await Promise.all([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        include: withBranch,
        // ADR-BRD-03 — 회원 웹 홈의 "최근 공지"가 1회 호출로 끝나도록 최신순을 고를 수 있다. id는 같은 시각의 동점 정렬용.
        orderBy: filter.latestFirst ? [{ createdAt: 'desc' }, { id: 'desc' }] : [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
    ]);
    return { items: toViews(rows), total };
  }

  /** 보이지 않거나 없거나 삭제된 글은 모두 404(존재 여부를 드러내지 않는다 — 게시판 A-7). */
  async findVisible(id: string, user: RequestUser): Promise<PostRow> {
    const row = await this.prisma.post.findFirst({
      where: { AND: [{ id, deletedAt: null }, this.visibleWhere(user)] },
      include: withBranch,
    });
    if (!row) throw postNotFound();
    return row;
  }

  // 조회수는 한 문장 안에서 원자적으로 올린다(D36 결정 2 — mock의 viewCount += 1은 동시 조회 시 증가분을 잃는다).
  async viewDetail(id: string, user: RequestUser): Promise<PostView> {
    await this.findVisible(id, user);
    const row = await this.prisma.post.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
      include: withBranch,
    });
    return toViews([row])[0];
  }

  // 게시판 A-5 — 본사는 HQ_TO_BRANCH(전체 또는 특정 지점 지정), 지점장은 BRANCH_TO_MEMBER만(범위·지점은 서버가 강제).
  async create(
    author: { accountId: string; role: RequestUser['role']; branchId?: string },
    input: { title: string; content: string; category: PostCategory; branchId?: string; visibleToMember?: boolean; facilityId?: string },
  ): Promise<PostView> {
    // D62 — 본문은 허용 목록으로 정화한 HTML로 저장한다. 정화 뒤 글자가 없으면 빈 글이다.
    const content = sanitizePostContent(input.content);
    if (!hasText(content)) throw emptyContent();
    let scope: PostScope;
    let branchId: string | undefined;
    if (author.role === 'SUPER_ADMIN') {
      scope = 'HQ_TO_BRANCH';
      branchId = input.branchId;
      if (branchId && !(await this.prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } }))) {
        throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
      }
      // ADR-BRD-05 — 시설 지정은 현장→이용자 공지(지점 관리자)만. 본사 공지는 지점 단위까지다.
      if (input.facilityId) throw facilityNotAllowed();
    } else {
      if (!author.branchId) {
        throw new AppException('BRANCH_REQUIRED', '소속 지점이 없는 계정입니다.', 403);
      }
      if ((await this.branchService.loadGate()).isTerminated(author.branchId)) {
        throw new AppException('BRANCH_TERMINATED', '위탁계약이 종료된 지점에서는 새 게시글을 작성할 수 없습니다.', 409);
      }
      scope = 'BRANCH_TO_MEMBER';
      branchId = author.branchId;
    }
    const row = await this.prisma.post.create({
      data: {
        scope,
        branchId,
        authorId: author.accountId,
        category: input.category,
        title: input.title,
        content,
        publishedAt: new Date(`${todayKst()}T00:00:00Z`),
        // ADR-BRD-01 — BRANCH_TO_MEMBER는 scope로 이미 회원에게 노출되므로 항상 true, HQ 공지는 명시 안 하면 false.
        visibleToMember: scope === 'BRANCH_TO_MEMBER' ? true : (input.visibleToMember ?? false),
        // 시설이 작성자 지점 소속인지는 BranchScopeGuard(@ScopedResource('facility', body))가 이미 봤다.
        facilityId: input.facilityId,
      },
      include: withBranch,
    });
    return toViews([row])[0];
  }

  // 수정은 삭제되지 않았을 때만(D36 결정 2) — 권한(작성자 본인)은 컨트롤러가 먼저 본다.
  async update(
    post: Pick<Post, 'id' | 'scope' | 'branchId'>,
    input: { title?: string; content?: string; category?: PostCategory; facilityId?: string | null },
  ): Promise<PostView> {
    const id = post.id;
    const content = input.content === undefined ? undefined : sanitizePostContent(input.content);
    if (content !== undefined && !hasText(content)) throw emptyContent();
    // ADR-BRD-05 — 시설은 그 글의 지점 시설만. 경로가 글 id라 가드가 본문 시설을 볼 수 없어 여기서 확인한다.
    if (input.facilityId) {
      if (post.scope !== 'BRANCH_TO_MEMBER') throw facilityNotAllowed();
      const facility = await this.prisma.facility.findUnique({ where: { id: input.facilityId }, select: { branchId: true } });
      if (!facility) throw new AppException('FACILITY_NOT_FOUND', '시설을 찾을 수 없습니다.', 404);
      if (facility.branchId !== post.branchId) {
        throw new AppException('FACILITY_BRANCH_MISMATCH', '시설은 게시글과 같은 지점 소속이어야 합니다.', 400);
      }
    }
    const { count } = await this.prisma.post.updateMany({
      where: { id, deletedAt: null },
      data: { title: input.title, content, category: input.category, facilityId: input.facilityId },
    });
    if (count === 0) throw postNotFound();
    const row = await this.prisma.post.findUniqueOrThrow({ where: { id }, include: withBranch });
    return toViews([row])[0];
  }

  // 게시판 A-6 — 물리 삭제 대신 소프트 삭제. 두 번째 삭제는 404.
  async softDelete(id: string): Promise<void> {
    const { count } = await this.prisma.post.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
    if (count === 0) throw postNotFound();
  }
}

function toViews(rows: PostRow[]): PostView[] {
  return rows.map((r) => ({
    ...toMockPost(r),
    authorName: r.author.name,
    branchName: r.branch?.name,
    facilityName: r.facility?.name,
  }));
}

function emptyContent() {
  return new AppException('POST_CONTENT_EMPTY', '내용을 입력하세요.', 400);
}

function facilityNotAllowed() {
  return new AppException('POST_FACILITY_NOT_ALLOWED', '시설 지정은 지점 공지(현장 → 이용자)에서만 할 수 있습니다.', 400);
}

function postNotFound() {
  return new AppException('POST_NOT_FOUND', '게시글을 찾을 수 없습니다.', 404);
}

function toMockPost(r: Post): MockPost {
  return {
    id: r.id,
    scope: r.scope,
    branchId: r.branchId ?? undefined,
    authorId: r.authorId,
    category: r.category,
    title: r.title,
    content: r.content,
    viewCount: r.viewCount,
    publishedAt: toKstDateString(r.publishedAt),
    deletedAt: r.deletedAt?.toISOString(),
    visibleToMember: r.visibleToMember,
    facilityId: r.facilityId ?? undefined,
  };
}
