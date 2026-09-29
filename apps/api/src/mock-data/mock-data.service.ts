import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { todayKst } from '../common/date/kst-date';
import {
  MockAccount,
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

}
