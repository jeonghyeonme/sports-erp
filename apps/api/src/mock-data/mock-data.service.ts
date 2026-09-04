import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  MockAccount,
  MockBranch,
  MockFacility,
  MockMember,
  MockPost,
  MockProgram,
  MockStaff,
} from './mock-data.types';

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
  private readonly passwordHash = bcrypt.hashSync(MOCK_DEMO_PASSWORD, 10);

  readonly branches: MockBranch[] = [
    { id: 'branch-seocho', name: '서초점', address: '서울시 서초구' },
    { id: 'branch-gangnam', name: '강남점', address: '서울시 강남구' },
  ];

  readonly accounts: MockAccount[] = [
    {
      id: 'account-haneul',
      email: 'jeong.haneul@spoism.example',
      passwordHash: this.passwordHash,
      role: 'SUPER_ADMIN',
      name: '정하늘',
    },
    {
      id: 'account-minsu',
      email: 'kim.minsu@spoism.example',
      passwordHash: this.passwordHash,
      role: 'BRANCH_ADMIN',
      name: '김민수',
      branchId: 'branch-seocho',
      staffId: 'staff-minsu',
    },
    {
      id: 'account-seoyeon',
      email: 'park.seoyeon@spoism.example',
      passwordHash: this.passwordHash,
      role: 'STAFF',
      name: '박서연',
      branchId: 'branch-seocho',
      staffId: 'staff-seoyeon',
    },
    {
      id: 'account-sujin',
      email: 'lee.sujin@example.com',
      passwordHash: this.passwordHash,
      role: 'MEMBER',
      name: '이수진',
      branchId: 'branch-seocho',
      memberId: 'member-sujin',
    },
    // 강남점 관리자 — 지점 격리(BranchScopeGuard) 동작을 시연하기 위해
    // 실제 Prisma 시드(prisma/seed.ts)에는 없는, 구조 시연 전용 더미 계정입니다.
    {
      id: 'account-gangnam-admin',
      email: 'choi.gangnam@spoism.example',
      passwordHash: this.passwordHash,
      role: 'BRANCH_ADMIN',
      name: '최강남',
      branchId: 'branch-gangnam',
      staffId: 'staff-choi',
    },
  ];

  readonly staff: MockStaff[] = [
    {
      id: 'staff-minsu',
      accountId: 'account-minsu',
      branchId: 'branch-seocho',
      staffCode: 'SEOCHO-001',
      name: '김민수',
      position: '지점장',
      employmentType: '정규직',
      hireDate: '2021-03-02',
    },
    {
      id: 'staff-seoyeon',
      accountId: 'account-seoyeon',
      branchId: 'branch-seocho',
      staffCode: 'SEOCHO-002',
      name: '박서연',
      position: '트레이너',
      employmentType: '정규직',
      hireDate: '2022-07-11',
    },
    {
      id: 'staff-choi',
      accountId: 'account-gangnam-admin',
      branchId: 'branch-gangnam',
      staffCode: 'GANGNAM-001',
      name: '최강남',
      position: '지점장',
      employmentType: '정규직',
      hireDate: '2023-01-10',
    },
  ];

  readonly members: MockMember[] = [
    {
      id: 'member-sujin',
      accountId: 'account-sujin',
      branchId: 'branch-seocho',
      memberNo: 'SEOCHO2026-001',
      name: '이수진',
      phone: '010-1234-5678',
      status: 'ACTIVE',
      joinedAt: '2026-03-15',
    },
    {
      id: 'member-younghee',
      branchId: 'branch-gangnam',
      memberNo: 'GANGNAM2026-001',
      name: '오영희',
      phone: '010-2345-6789',
      status: 'ACTIVE',
      joinedAt: '2026-02-01',
    },
    {
      id: 'member-dormant',
      branchId: 'branch-seocho',
      memberNo: 'SEOCHO2025-014',
      name: '한지민',
      phone: '010-9999-0000',
      status: 'DORMANT',
      joinedAt: '2025-05-20',
    },
  ];

  readonly programs: MockProgram[] = [
    {
      id: 'program-seocho-yoga',
      branchId: 'branch-seocho',
      name: '아침 요가',
      category: '요가',
      pricingType: 'PAID_SESSION',
      price: 30000,
      capacity: 15,
      status: 'RUNNING',
      startDate: '2026-01-05',
      instructorName: '박서연',
    },
    {
      id: 'program-seocho-pt',
      branchId: 'branch-seocho',
      name: '퍼스널 트레이닝',
      category: 'PT',
      pricingType: 'PT_PACKAGE',
      price: 60000,
      status: 'RUNNING',
      startDate: '2026-01-05',
      instructorName: '박서연',
    },
    {
      id: 'program-seocho-freegym',
      branchId: 'branch-seocho',
      name: '헬스장 자유이용',
      category: '헬스',
      pricingType: 'FREE_ACCESS',
      price: 0,
      status: 'RUNNING',
      startDate: '2025-01-01',
    },
    {
      id: 'program-seocho-pilates',
      branchId: 'branch-seocho',
      name: '필라테스 (10월 개강 예정)',
      category: '필라테스',
      pricingType: 'PAID_SESSION',
      price: 35000,
      capacity: 12,
      status: 'PREPARING',
      startDate: '2026-10-01',
      instructorName: '박서연',
    },
    {
      id: 'program-gangnam-pilates',
      branchId: 'branch-gangnam',
      name: '강남점 필라테스',
      category: '필라테스',
      pricingType: 'PAID_SESSION',
      price: 40000,
      capacity: 10,
      status: 'RUNNING',
      startDate: '2026-02-01',
    },
  ];

  readonly posts: MockPost[] = [
    {
      id: 'post-hq-manual',
      scope: 'HQ_TO_BRANCH',
      authorName: '정하늘',
      category: 'TRAINING_MATERIAL',
      title: 'ERP 시스템 사용 매뉴얼 안내',
      content: '전 지점 팀장급 직원 대상 ERP 사용법 매뉴얼을 게시판에 업로드했습니다.',
      publishedAt: '2026-08-20',
    },
    {
      id: 'post-seocho-event',
      scope: 'BRANCH_TO_MEMBER',
      branchId: 'branch-seocho',
      authorName: '김민수',
      category: 'EVENT',
      title: '9월 아침 요가 이벤트 안내',
      content: '9월 한 달간 아침 요가 신규 회원 20% 할인 이벤트를 진행합니다.',
      publishedAt: '2026-08-28',
    },
  ];

  readonly facilities: MockFacility[] = [
    {
      id: 'facility-seocho-gym',
      branchId: 'branch-seocho',
      name: '서초점 헬스장',
      type: 'GYM',
      capacity: 60,
      currentCount: 18,
      level: 2,
    },
    {
      id: 'facility-seocho-pool',
      branchId: 'branch-seocho',
      name: '서초점 수영장',
      type: 'POOL',
      capacity: 30,
      currentCount: 26,
      level: 5,
    },
    {
      id: 'facility-gangnam-gym',
      branchId: 'branch-gangnam',
      name: '강남점 헬스장',
      type: 'GYM',
      capacity: 50,
      currentCount: 12,
      level: 2,
    },
  ];

  findAccountByEmail(email: string): MockAccount | undefined {
    return this.accounts.find((a) => a.email === email);
  }

  findAccountById(id: string): MockAccount | undefined {
    return this.accounts.find((a) => a.id === id);
  }

  findBranchById(id: string): MockBranch | undefined {
    return this.branches.find((b) => b.id === id);
  }

  branchSummary(branchId: string) {
    const branch = this.findBranchById(branchId);
    return {
      id: branchId,
      name: branch?.name ?? branchId,
      memberCount: this.members.filter((m) => m.branchId === branchId).length,
      staffCount: this.staff.filter((s) => s.branchId === branchId).length,
      runningProgramCount: this.programs.filter(
        (p) => p.branchId === branchId && p.status === 'RUNNING',
      ).length,
    };
  }
}
