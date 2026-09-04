// Phase 1 스캐폴딩 단계의 인메모리 더미 데이터 타입 정의.
// 실제 DB(Prisma) 연동 전까지 apps/api 전체가 이 타입들을 기준으로 동작합니다.
// 필드 구성은 prisma/schema.prisma를 최대한 그대로 따릅니다 — 나중에 MockDataService를
// PrismaService 기반 리포지토리로 교체할 때 컨트롤러 코드는 거의 손대지 않아도 되도록 하기 위함입니다.

export type Role = 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'STAFF' | 'MEMBER';
export type ProgramStatus = 'PREPARING' | 'RUNNING' | 'PAUSED' | 'ENDED';
export type PricingType = 'FREE_ACCESS' | 'PAID_SESSION' | 'PT_PACKAGE';
export type PostScope = 'HQ_TO_BRANCH' | 'BRANCH_TO_MEMBER';

export interface MockBranch {
  id: string;
  name: string;
  address?: string;
}

export interface MockAccount {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  name: string;
  // 실제 스키마에서는 Account에 branchId가 없고 Staff/Member를 거쳐 조회하지만,
  // 더미 데이터에서는 조회 편의를 위해 비정규화해서 들고 있습니다.
  branchId?: string;
  staffId?: string;
  memberId?: string;
}

export interface MockStaff {
  id: string;
  accountId: string;
  branchId: string;
  staffCode: string;
  name: string;
  position?: string;
  employmentType?: string;
  hireDate: string;
}

export interface MockMember {
  id: string;
  accountId?: string;
  branchId: string;
  memberNo: string;
  name: string;
  phone?: string;
  status: 'ACTIVE' | 'DORMANT' | 'WITHDRAWN';
  joinedAt: string;
}

export interface MockProgram {
  id: string;
  branchId: string;
  name: string;
  category: string;
  pricingType: PricingType;
  price: number;
  capacity?: number;
  status: ProgramStatus;
  startDate: string;
  instructorName?: string;
}

export interface MockPost {
  id: string;
  scope: PostScope;
  branchId?: string;
  authorName: string;
  category: string;
  title: string;
  content: string;
  publishedAt: string;
}

export interface MockFacility {
  id: string;
  branchId: string;
  name: string;
  type: 'GYM' | 'POOL' | 'GOLF' | 'READING_ROOM' | 'ETC';
  capacity: number;
  currentCount: number;
  level: number;
}
