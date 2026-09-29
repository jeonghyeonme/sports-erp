import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { todayKst } from '../common/date/kst-date';
import {
  AssetCategory,
  AssetStatus,
  AssetType,
  MockAccount,
  MockAsset,
  MockBranch,
  MockPost,
  PostScope,
  Role,
} from './mock-data.types';
import { generateLightBranches } from './branch-generator';
import { HERO_BRANCHES, toMockBranch } from './branch-fixtures';
import { BranchGate } from '../modules/branches/branch-gate';
import { AppException } from '../common/exceptions/app.exception';


// 데모 계정 공통 비밀번호. prisma/seed.ts의 DEMO_PASSWORD와 동일하게 맞춰서,
// 나중에 실제 DB로 전환해도 로그인 테스트 계정 정보가 바뀌지 않도록 합니다.
export const MOCK_DEMO_PASSWORD = 'demo-password-1234';

/**
 * Phase 1 스캐폴딩 단계의 인메모리 더미 데이터 저장소.
 * Docker/PostgreSQL 없이도 `npm run dev`만으로 전체 구조를 확인할 수 있도록,
 * PrismaService 대신 이 서비스가 임시로 데이터 소스 역할을 합니다.
 * 실제 기능 구현 단계에서는 이 서비스를 Prisma 기반 리포지토리로 교체합니다.
 */
@Injectable()
export class MockDataService {
  // 원본 RFP가 명시하는 "전국 98개 업장" 규모를 화면에서 실제로 검증하기 위한 생성 데이터.
  // 서초점·강남점 2개는 아래처럼 손으로 채운 "히어로" 지점(데모 로그인 계정이 여기 물려 있음)이고,
  // 나머지 96개는 branch-generator.ts가 인덱스 기반으로 결정적으로 만든다.
  private readonly generated = generateLightBranches();

  // D29 — 이름표 사본(계약 필드 없음). 원천은 DB이고 시드와 같은 목록(branch-fixtures.ts)에서 만든다.
  readonly branches: MockBranch[] = [...HERO_BRANCHES, ...this.generated.branches].map(toMockBranch);

  // D30 — 관리자·직원 계정은 DB가 원천이고 여기에는 앱이 뜰 때 채우는 미러(StaffService)가 들어온다.
  // D32 — 회원 계정도 DB로 옮겨져 mock이 원천인 계정은 없다. 게시판이 작성자 이름을 읽는 용도로만 남는다.
  // 다른 미러는 독자가 DB로 옮겨지며 없앴다 — 카탈로그(D32), 파견 이력(D33, 근태), 직원(D34, 문서).
  readonly accounts: MockAccount[] = [];

  // 1-10문서 §4 — 서초점 데모 자산. 러닝머신은 100만원 초과라 FIXED_ASSET, 소독제는 CONSUMABLE.
  readonly assets: MockAsset[] = [
    {
      id: 'asset-seocho-treadmill',
      assetCode: 'SEOCHO-A001',
      branchId: 'branch-seocho',
      name: '러닝머신',
      category: 'EXERCISE_EQUIPMENT',
      assetType: 'FIXED_ASSET',
      acquiredAt: '2025-03-10',
      acquisitionCost: 3200000,
      usefulLifeYears: 5,
      status: 'NORMAL',
      quantity: 1,
      location: '2층 헬스장',
    },
    {
      id: 'asset-seocho-aed',
      assetCode: 'SEOCHO-A002',
      branchId: 'branch-seocho',
      name: '자동제세동기(AED)',
      category: 'SAFETY_EQUIPMENT',
      assetType: 'FIXED_ASSET',
      acquiredAt: '2025-06-01',
      acquisitionCost: 1800000,
      usefulLifeYears: 5,
      status: 'REPAIRING',
      quantity: 1,
      location: '1층 로비',
    },
    {
      id: 'asset-seocho-sanitizer',
      assetCode: 'SEOCHO-A003',
      branchId: 'branch-seocho',
      name: '손소독제',
      category: 'OTHER',
      assetType: 'CONSUMABLE',
      acquiredAt: '2026-08-01',
      acquisitionCost: 45000,
      status: 'NORMAL',
      quantity: 12,
    },
  ];

  readonly posts: MockPost[] = [
    {
      id: 'post-hq-manual',
      scope: 'HQ_TO_BRANCH',
      authorId: 'account-haneul',
      category: 'TRAINING_MATERIAL',
      title: 'ERP 시스템 사용 매뉴얼 안내',
      content: '전 지점 팀장급 직원 대상 ERP 사용법 매뉴얼을 게시판에 업로드했습니다.',
      viewCount: 0,
      publishedAt: '2026-08-20',
      visibleToMember: false,
    },
    {
      id: 'post-seocho-event',
      scope: 'BRANCH_TO_MEMBER',
      branchId: 'branch-seocho',
      authorId: 'account-minsu',
      category: 'EVENT',
      title: '9월 아침 요가 이벤트 안내',
      content: '9월 한 달간 아침 요가 신규 회원 20% 할인 이벤트를 진행합니다.',
      viewCount: 0,
      publishedAt: '2026-08-28',
      visibleToMember: true,
    },
  ];


  findAccountById(id: string): MockAccount | undefined {
    return this.accounts.find((a) => a.id === id);
  }


  findBranchById(id: string): MockBranch | undefined {
    return this.branches.find((b) => b.id === id);
  }




  findPostById(id: string): MockPost | undefined {
    return this.posts.find((p) => p.id === id && !p.deletedAt);
  }

  // 04문서 §5 POST /posts — SUPER_ADMIN은 HQ_TO_BRANCH(전체공지 또는 특정 지점 지정 가능),
  // BRANCH_ADMIN은 BRANCH_TO_MEMBER만 작성 가능하고 scope·branchId는 서버가 본인 지점으로 강제한다.
  createPost(
    author: { accountId: string; role: Role; branchId?: string },
    input: {
      title: string;
      content: string;
      category: MockPost['category'];
      branchId?: string;
      visibleToMember?: boolean;
    },
    gate: BranchGate,
  ): MockPost {
    let scope: PostScope;
    let branchId: string | undefined;

    if (author.role === 'SUPER_ADMIN') {
      scope = 'HQ_TO_BRANCH';
      branchId = input.branchId;
      if (branchId && !this.findBranchById(branchId)) {
        throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
      }
    } else {
      if (!author.branchId) {
        throw new AppException('BRANCH_REQUIRED', '소속 지점이 없는 계정입니다.', 403);
      }
      if (gate.isTerminated(author.branchId)) {
        throw new AppException(
          'BRANCH_TERMINATED',
          '위탁계약이 종료된 지점에서는 새 게시글을 작성할 수 없습니다.',
          409,
        );
      }
      scope = 'BRANCH_TO_MEMBER';
      branchId = author.branchId;
    }

    const post: MockPost = {
      id: `post-${randomUUID()}`,
      scope,
      branchId,
      authorId: author.accountId,
      category: input.category,
      title: input.title,
      content: input.content,
      viewCount: 0,
      publishedAt: todayKst(),
      // ADR-BRD-01 — BRANCH_TO_MEMBER는 scope로 이미 회원에게 노출되므로 항상 true.
      // HQ_TO_BRANCH는 작성자(SUPER_ADMIN)가 명시하지 않으면 기본 false(안전 측 우선).
      visibleToMember: scope === 'BRANCH_TO_MEMBER' ? true : (input.visibleToMember ?? false),
    };
    this.posts.push(post);
    return post;
  }

  // 04문서 §5 PATCH /posts/:id — 작성자 본인만 수정 가능(컨트롤러에서 authorId 검사).
  updatePost(id: string, input: Partial<Pick<MockPost, 'title' | 'content' | 'category'>>): MockPost {
    const post = this.findPostById(id);
    if (!post) {
      throw new AppException('POST_NOT_FOUND', '게시글을 찾을 수 없습니다.', 404);
    }
    if (input.title !== undefined) post.title = input.title;
    if (input.content !== undefined) post.content = input.content;
    if (input.category !== undefined) post.category = input.category;
    return post;
  }

  // 04문서 §6 — 물리 삭제 대신 deletedAt으로 소프트 삭제.
  deletePost(id: string): void {
    const post = this.findPostById(id);
    if (!post) {
      throw new AppException('POST_NOT_FOUND', '게시글을 찾을 수 없습니다.', 404);
    }
    post.deletedAt = new Date().toISOString();
  }

  incrementPostView(id: string): MockPost {
    const post = this.findPostById(id);
    if (!post) {
      throw new AppException('POST_NOT_FOUND', '게시글을 찾을 수 없습니다.', 404);
    }
    post.viewCount += 1;
    return post;
  }

  // ── D30 계정 미러 — StaffService만 쓴다(원천은 DB) ─────────────────────────────

  /** 앱이 뜰 때 DB의 관리자·직원 계정 전체로 미러를 채운다. 배열 참조는 유지한다(readonly 필드를 다른 코드가 붙잡고 있을 수 있음). */
  replaceAccountMirror(accounts: MockAccount[]): void {
    this.accounts.splice(0, this.accounts.length, ...accounts);
  }

  /** 직원 쓰기가 커밋된 뒤 그 직원의 계정 하나를 교체한다. */
  upsertAccountMirror(account: MockAccount): void {
    const i = this.accounts.findIndex((a) => a.id === account.id);
    if (i >= 0) this.accounts[i] = account;
    else this.accounts.push(account);
  }


  findAssetById(id: string): MockAsset | undefined {
    return this.assets.find((a) => a.id === id);
  }

  // 1-10문서 §4-6 — 취득가액 100만원 초과면 고정자산, 이하면 소모품(세법상 즉시비용 처리 기준).
  private classifyAssetType(acquisitionCost: number): AssetType {
    return acquisitionCost > 1_000_000 ? 'FIXED_ASSET' : 'CONSUMABLE';
  }

  // `{지점코드}-A{순번}` — 폐기된 자산도 순번을 계속 차지하므로(재사용 안 함) 접두사로 시작하는 전체 개수 기준.
  private generateAssetCode(branchId: string): string {
    const code = this.findBranchById(branchId)?.code ?? 'BR';
    const seq = this.assets.filter((a) => a.assetCode.startsWith(`${code}-A`)).length + 1;
    return `${code}-A${String(seq).padStart(3, '0')}`;
  }

  // 1-10문서 §5 POST /assets — 권한·지점 강제는 컨트롤러에서 한다.
  // ADR-RES-01 — 계약종료(TERMINATED) 지점의 신규 자산 등록 차단. 자산은 SUPER_ADMIN도 직접 만들 수 있어
  // 역할 분기 없이 대상 branchId만으로 판정한다(BRANCH_ADMIN 한정인 createFacility 등과 다른 점).
  createAsset(input: {
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
  }, gate: BranchGate): MockAsset {
    const branch = this.findBranchById(input.branchId);
    if (!branch) {
      throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
    }
    if (gate.isTerminated(input.branchId)) {
      throw new AppException(
        'BRANCH_TERMINATED',
        '위탁계약이 종료된 지점에는 새 자산을 등록할 수 없습니다.',
        409,
      );
    }
    // 자동 판정 결과를 관리자가 수동으로 덮어쓸 수 있다(고가 소모품을 고정자산 취급하는 경우 등).
    const assetType = input.assetType ?? this.classifyAssetType(input.acquisitionCost);
    const asset: MockAsset = {
      id: `asset-${randomUUID()}`,
      assetCode: this.generateAssetCode(input.branchId),
      branchId: input.branchId,
      name: input.name,
      category: input.category,
      assetType,
      acquiredAt: input.acquiredAt,
      acquisitionCost: input.acquisitionCost,
      usefulLifeYears: assetType === 'FIXED_ASSET' ? input.usefulLifeYears : undefined,
      status: 'NORMAL',
      quantity: assetType === 'FIXED_ASSET' ? 1 : (input.quantity ?? 1),
      location: input.location,
      note: input.note,
    };
    this.assets.push(asset);
    return asset;
  }

  // 상태·위치·수량·메모만 수정 — 상태 전이는 변경 이력 추적을 위해 별도 메서드로 분리(§5).
  updateAsset(
    id: string,
    input: Partial<{ name: string; location: string; quantity: number; note: string; usefulLifeYears: number }>,
  ): MockAsset {
    const asset = this.findAssetById(id);
    if (!asset) {
      throw new AppException('ASSET_NOT_FOUND', '자산을 찾을 수 없습니다.', 404);
    }
    if (input.name !== undefined) asset.name = input.name;
    if (input.location !== undefined) asset.location = input.location || undefined;
    if (input.note !== undefined) asset.note = input.note || undefined;
    if (input.usefulLifeYears !== undefined && asset.assetType === 'FIXED_ASSET') {
      asset.usefulLifeYears = input.usefulLifeYears;
    }
    if (input.quantity !== undefined) {
      if (asset.assetType === 'FIXED_ASSET' && input.quantity !== 1) {
        throw new AppException('INVALID_QUANTITY', '고정자산은 개체 단위 관리라 수량이 항상 1입니다.', 400);
      }
      asset.quantity = input.quantity;
    }
    return asset;
  }

  // 1-10문서 §4-4 "정상→수리중→폐기대상→폐기됨". 되돌림(수리 완료·폐기 보류)은 실무상 필요해 허용하되
  // 폐기됨은 종결 상태로 둔다 — 문서가 역방향 전이를 명시하지 않아 이 해석은 구현 시점의 판단이다.
  private static readonly ASSET_STATUS_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
    NORMAL: ['REPAIRING', 'DISPOSAL_PENDING'],
    REPAIRING: ['NORMAL', 'DISPOSAL_PENDING'],
    DISPOSAL_PENDING: ['NORMAL', 'DISPOSED'],
    DISPOSED: [],
  };

  updateAssetStatus(id: string, status: AssetStatus): MockAsset {
    const asset = this.findAssetById(id);
    if (!asset) {
      throw new AppException('ASSET_NOT_FOUND', '자산을 찾을 수 없습니다.', 404);
    }
    if (!MockDataService.ASSET_STATUS_TRANSITIONS[asset.status].includes(status)) {
      throw new AppException(
        'INVALID_STATUS_TRANSITION',
        `${asset.status} 상태에서 ${status}(으)로 전이할 수 없습니다.`,
        409,
      );
    }
    asset.status = status;
    return asset;
  }

}
