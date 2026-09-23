import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { addYearsToDateString, kstHoursMinutes, toKstDateString, todayKst } from '../common/date/kst-date';
import {
  AssetCategory,
  AssetStatus,
  AssetType,
  AttendanceStatus,
  DocumentCategory,
  FacilityType,
  LeaveType,
  MockAccount,
  MockAsset,
  MockDocument,
  MockAttendanceRecord,
  MockBranch,
  MockFacility,
  MockInstructor,
  MockLeaveBalance,
  MockLeaveRequest,
  MockMember,
  MockPayment,
  MockPost,
  MockProgram,
  MockRefreshToken,
  MockReservation,
  MockScheduleSlot,
  MockStaff,
  MockStaffAssignment,
  MockWorkLog,
  PostScope,
  Role,
} from './mock-data.types';
import { generateLightBranches } from './branch-generator';
import { AppException } from '../common/exceptions/app.exception';
import { RequestUser } from '../common/interfaces/request-user.interface';

// 07문서 §3-2 상태 전이표. ENDED는 종결 상태라 다음 상태가 없다.
const PROGRAM_STATUS_TRANSITIONS: Record<MockProgram['status'], MockProgram['status'][]> = {
  PREPARING: ['RUNNING', 'ENDED'],
  RUNNING: ['PAUSED', 'ENDED'],
  PAUSED: ['RUNNING', 'ENDED'],
  ENDED: [],
};

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

  // 원본 RFP가 명시하는 "전국 98개 업장" 규모를 화면에서 실제로 검증하기 위한 생성 데이터.
  // 서초점·강남점 2개는 아래처럼 손으로 채운 "히어로" 지점(데모 로그인 계정이 여기 물려 있음)이고,
  // 나머지 96개는 branch-generator.ts가 인덱스 기반으로 결정적으로 만든다.
  private readonly generated = generateLightBranches();

  readonly branches: MockBranch[] = [
    {
      id: 'branch-seocho',
      name: '서초점',
      address: '서울시 서초구',
      region: '서울',
      code: 'SEOCHO',
      standardCheckInTime: '09:00',
      cancellationDeadlineHours: 24,
      contractPartner: '서초 OO아파트 입주자대표회의',
      contractStartAt: '2024-03-01',
      contractEndAt: '2027-02-28',
      contractStatus: 'ACTIVE',
    },
    {
      id: 'branch-gangnam',
      name: '강남점',
      address: '서울시 강남구',
      region: '서울',
      code: 'GANGNAM',
      standardCheckInTime: '09:30',
      cancellationDeadlineHours: 24,
      contractPartner: '강남 OO오피스텔 관리사무소',
      contractStartAt: '2023-10-01',
      contractEndAt: '2026-10-15',
      contractStatus: 'RENEWAL_DUE',
    },
    ...this.generated.branches,
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
      phone: '010-1111-2222',
      position: '지점장',
      employmentType: '정규직',
      hireDate: '2021-03-02',
      status: 'ACTIVE',
    },
    {
      id: 'staff-seoyeon',
      accountId: 'account-seoyeon',
      branchId: 'branch-seocho',
      staffCode: 'SEOCHO-002',
      name: '박서연',
      phone: '010-2222-3333',
      position: '트레이너',
      employmentType: '정규직',
      hireDate: '2022-07-11',
      status: 'ACTIVE',
    },
    {
      id: 'staff-choi',
      accountId: 'account-gangnam-admin',
      branchId: 'branch-gangnam',
      staffCode: 'GANGNAM-001',
      name: '최강남',
      phone: '010-3333-4444',
      position: '지점장',
      employmentType: '정규직',
      hireDate: '2023-01-10',
      status: 'ACTIVE',
    },
    ...this.generated.staff,
  ];

  // 최초 파견 이력 — 02문서 §3 "신규 등록 시 최초 StaffAssignment 자동 생성" 원칙을
  // 시드 데이터에도 그대로 적용해, 모든 기존 직원이 처음부터 정확히 1건의 활성 파견을 갖게 한다.
  readonly staffAssignments: MockStaffAssignment[] = this.staff.map((s) => ({
    id: `assignment-${s.id}`,
    staffId: s.id,
    branchId: s.branchId,
    startDate: s.hireDate,
    assignedBy: 'account-haneul',
  }));

  readonly members: MockMember[] = [
    {
      id: 'member-sujin',
      accountId: 'account-sujin',
      branchId: 'branch-seocho',
      assignedStaffId: 'staff-seoyeon', // 박서연 트레이너 담당
      memberNo: 'SEOCHO2026-001',
      name: '이수진',
      phone: '010-1234-5678',
      status: 'ACTIVE',
      joinedAt: '2026-03-15',
      guardianConsent: false,
    },
    {
      id: 'member-younghee',
      branchId: 'branch-gangnam',
      memberNo: 'GANGNAM2026-001',
      name: '오영희',
      phone: '010-2345-6789',
      status: 'ACTIVE',
      joinedAt: '2026-02-01',
      guardianConsent: false,
    },
    {
      id: 'member-dormant',
      branchId: 'branch-seocho',
      memberNo: 'SEOCHO2025-014',
      name: '한지민',
      phone: '010-9999-0000',
      status: 'DORMANT',
      joinedAt: '2025-05-20',
      guardianConsent: false,
    },
    ...this.generated.members,
  ];

  readonly instructors: MockInstructor[] = [
    {
      id: 'instructor-seoyeon',
      branchId: 'branch-seocho',
      name: '박서연',
      specialty: '요가·필라테스',
      isActive: true,
    },
    ...this.generated.instructors,
  ];

  readonly programs: MockProgram[] = [
    {
      id: 'program-seocho-yoga',
      branchId: 'branch-seocho',
      facilityId: 'facility-seocho-gym',
      instructorId: 'instructor-seoyeon',
      name: '아침 요가',
      category: '요가',
      ageGroup: 'ADULT',
      description: '기초 체력과 유연성을 함께 기르는 아침 요가 클래스입니다.',
      pricingType: 'PAID_SESSION',
      price: 30000,
      capacity: 15,
      status: 'RUNNING',
      startDate: '2026-01-05',
    },
    {
      id: 'program-seocho-pt',
      branchId: 'branch-seocho',
      facilityId: 'facility-seocho-gym',
      instructorId: 'instructor-seoyeon',
      name: '퍼스널 트레이닝',
      category: 'PT',
      ageGroup: 'ADULT',
      description: '1:1 맞춤 트레이닝 프로그램(세션 차감형).',
      pricingType: 'PT_PACKAGE',
      price: 60000,
      status: 'RUNNING',
      startDate: '2026-01-05',
    },
    {
      id: 'program-seocho-freegym',
      branchId: 'branch-seocho',
      facilityId: 'facility-seocho-gym',
      name: '헬스장 자유이용',
      category: '헬스',
      ageGroup: 'ALL',
      description: '헬스장 시설을 자유롭게 이용할 수 있는 상시 운영 프로그램입니다.',
      pricingType: 'FREE_ACCESS',
      price: 0,
      status: 'RUNNING',
      startDate: '2025-01-01',
    },
    {
      id: 'program-seocho-pilates',
      branchId: 'branch-seocho',
      facilityId: 'facility-seocho-gym',
      instructorId: 'instructor-seoyeon',
      name: '필라테스 (10월 개강 예정)',
      category: '필라테스',
      ageGroup: 'ADULT',
      description: '10월 개강 예정인 소규모 필라테스 클래스입니다.',
      pricingType: 'PAID_SESSION',
      price: 35000,
      capacity: 12,
      status: 'PREPARING',
      startDate: '2026-10-01',
    },
    {
      id: 'program-gangnam-pilates',
      branchId: 'branch-gangnam',
      facilityId: 'facility-gangnam-gym',
      name: '강남점 필라테스',
      category: '필라테스',
      ageGroup: 'ADULT',
      description: '강남점에서 운영하는 필라테스 클래스입니다.',
      pricingType: 'PAID_SESSION',
      price: 40000,
      capacity: 10,
      status: 'RUNNING',
      startDate: '2026-02-01',
    },
    ...this.generated.programs,
  ];

  // 06문서 §3 — '아침 요가'(PAID_SESSION, capacity 15)에 데모용 회차 2건을 시드해둔다.
  // 두 번째 회차는 정원을 일부러 작게 잡아 SLOT_FULL(정원 초과) 케이스를 바로 테스트할 수 있게 한다.
  readonly scheduleSlots: MockScheduleSlot[] = [
    {
      id: 'slot-seocho-yoga-1',
      programId: 'program-seocho-yoga',
      date: '2026-09-21',
      startTime: '07:00',
      endTime: '08:00',
      capacity: 15,
    },
    {
      id: 'slot-seocho-yoga-2',
      programId: 'program-seocho-yoga',
      date: '2026-09-22',
      startTime: '07:00',
      endTime: '08:00',
      capacity: 2,
    },
  ];

  readonly reservations: MockReservation[] = [];
  readonly payments: MockPayment[] = [];

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

  // 1-10문서 §5 — 전사 매뉴얼(영구 보관) + 서초점 위탁계약서(수동 보존기한, 임박 목록 시연용).
  readonly documents: MockDocument[] = [
    {
      id: 'doc-hq-manual',
      category: 'MANUAL',
      title: 'ERP 이용자 매뉴얼 v1',
      fileUrl: 'https://files.example/spoism/erp-manual-v1.pdf',
      fileType: 'pdf',
      fileSize: 2048000,
      uploadedBy: 'account-haneul',
      createdAt: '2026-08-20T09:00:00.000Z',
    },
    {
      id: 'doc-seocho-contract',
      category: 'CONTRACT',
      branchId: 'branch-seocho',
      title: '서초점 위탁운영계약서',
      fileUrl: 'https://files.example/spoism/seocho-contract.pdf',
      fileType: 'pdf',
      fileSize: 1024000,
      uploadedBy: 'account-haneul',
      retentionUntil: '2026-10-05',
      createdAt: '2026-01-05T09:00:00.000Z',
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
    ...this.generated.facilities,
  ];

  readonly refreshTokens: MockRefreshToken[] = [];

  findAccountByEmail(email: string): MockAccount | undefined {
    return this.accounts.find((a) => a.email === email);
  }

  findAccountById(id: string): MockAccount | undefined {
    return this.accounts.find((a) => a.id === id);
  }

  // 01문서 §6 — role/branchId를 매 요청 이 조회 결과로 새로 구성하는 단일 원천.
  // AuthService(로그인)와 JwtStrategy(매 요청 검증)가 둘 다 이 메서드를 써야
  // "JWT에 박제된 값" 문제가 재발하지 않는다.
  toRequestUser(account: MockAccount): RequestUser {
    const branch = account.branchId ? this.findBranchById(account.branchId) : undefined;
    return {
      accountId: account.id,
      email: account.email,
      name: account.name,
      role: account.role,
      branchId: account.branchId,
      branchName: branch?.name,
      staffId: account.staffId,
      memberId: account.memberId,
    };
  }

  updateAccountPassword(accountId: string, passwordHash: string): void {
    const account = this.findAccountById(accountId);
    if (!account) {
      throw new AppException('ACCOUNT_NOT_FOUND', '계정을 찾을 수 없습니다.', 404);
    }
    account.passwordHash = passwordHash;
  }

  // 01문서 §3 RefreshToken — id는 서명한 JWT의 jti와 동일하게 맞춰 조회 키로 쓴다.
  storeRefreshToken(id: string, accountId: string, tokenHash: string, expiresAt: string): void {
    this.refreshTokens.push({ id, accountId, tokenHash, expiresAt });
  }

  findRefreshToken(id: string): MockRefreshToken | undefined {
    return this.refreshTokens.find((t) => t.id === id);
  }

  // 로그아웃·rotate 공통 — 이미 revoke된 토큰에 다시 호출해도 안전(idempotent).
  revokeRefreshToken(id: string): void {
    const token = this.findRefreshToken(id);
    if (token) token.revokedAt = new Date().toISOString();
  }

  findBranchById(id: string): MockBranch | undefined {
    return this.branches.find((b) => b.id === id);
  }

  branchSummary(branchId: string) {
    const branch = this.findBranchById(branchId);
    return {
      id: branchId,
      name: branch?.name ?? branchId,
      region: branch?.region ?? '기타',
      memberCount: this.members.filter((m) => m.branchId === branchId).length,
      staffCount: this.staff.filter((s) => s.branchId === branchId).length,
      runningProgramCount: this.programs.filter(
        (p) => p.branchId === branchId && p.status === 'RUNNING',
      ).length,
      contractPartner: branch?.contractPartner,
      contractStatus: branch?.contractStatus ?? 'ACTIVE',
      contractStartAt: branch?.contractStartAt,
      contractEndAt: branch?.contractEndAt,
    };
  }

  // 본사(SUPER_ADMIN) 전용 — 지점 직원의 현재 권한(Account.role)을 지점명과 함께 조회.
  staffWithRole() {
    return this.staff.map((s) => {
      const account = this.findAccountById(s.accountId);
      const branch = this.findBranchById(s.branchId);
      return {
        staffId: s.id,
        branchId: s.branchId,
        branchName: branch?.name ?? s.branchId,
        staffCode: s.staffCode,
        name: s.name,
        position: s.position,
        role: account?.role ?? 'STAFF',
      };
    });
  }

  // 본사(SUPER_ADMIN)가 지점 직원을 STAFF <-> BRANCH_ADMIN으로 전환.
  // 실제 JWT는 로그인 시점에 role을 서명해 담으므로, 이미 로그인된 세션은 재로그인해야 반영된다.
  updateStaffRole(staffId: string, role: Extract<Role, 'STAFF' | 'BRANCH_ADMIN'>) {
    const staff = this.staff.find((s) => s.id === staffId);
    if (!staff) {
      throw new NotFoundException({ code: 'STAFF_NOT_FOUND', message: '직원을 찾을 수 없습니다.' });
    }
    const account = this.accounts.find((a) => a.id === staff.accountId);
    if (!account) {
      throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: '연결된 계정을 찾을 수 없습니다.' });
    }
    account.role = role;
    return this.staffWithRole().find((s) => s.staffId === staffId);
  }

  findMemberById(id: string): MockMember | undefined {
    return this.members.find((m) => m.id === id);
  }

  // `{지점코드}{연도}-{순번}` — 05문서 §3 memberNo 규칙.
  private generateMemberNo(branchId: string): string {
    const branch = this.findBranchById(branchId);
    const code = branch?.code ?? 'BR';
    const year = new Date().getFullYear();
    const prefix = `${code}${year}`;
    const seq =
      this.members.filter((m) => m.branchId === branchId && m.memberNo.startsWith(prefix)).length + 1;
    return `${prefix}-${String(seq).padStart(3, '0')}`;
  }

  private assertStaffInBranch(staffId: string, branchId: string): void {
    const staff = this.staff.find((s) => s.id === staffId);
    if (!staff || staff.branchId !== branchId) {
      throw new AppException(
        'STAFF_BRANCH_MISMATCH',
        '담당 직원은 회원과 같은 지점 소속이어야 합니다.',
        400,
      );
    }
  }

  // 현장 오프라인 등록 — 05문서 §5 POST /members, §6 비즈니스 로직. BRANCH_ADMIN 전용(컨트롤러에서 강제).
  createMember(
    branchId: string,
    input: {
      name: string;
      phone?: string;
      birthDate?: string;
      gender?: string;
      assignedStaffId?: string;
      guardianConsent?: boolean;
      memo?: string;
    },
  ): { member: MockMember; warnings: string[] } {
    const branch = this.findBranchById(branchId);
    if (!branch) {
      throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
    }
    if (branch.contractStatus === 'TERMINATED') {
      throw new AppException(
        'BRANCH_TERMINATED',
        '위탁계약이 종료된 지점에는 신규 회원을 등록할 수 없습니다.',
        409,
      );
    }
    if (input.assignedStaffId) {
      this.assertStaffInBranch(input.assignedStaffId, branchId);
    }
    // 05문서 §6 — 만 19세 미만은 법정대리인 동의 없이는 등록/가입 자체를 막는다(체크박스 수준).
    // birthDate를 안 넘긴 경우는 나이를 알 수 없으니 이 검사 대상이 아니다.
    if (input.birthDate && this.isMinor(input.birthDate) && !input.guardianConsent) {
      throw new AppException(
        'GUARDIAN_CONSENT_REQUIRED',
        '만 19세 미만 회원은 법정대리인 동의가 필요합니다.',
        400,
      );
    }

    const warnings: string[] = [];
    if (
      input.phone &&
      this.members.some(
        (m) => m.branchId === branchId && m.phone === input.phone && m.status === 'ACTIVE',
      )
    ) {
      warnings.push('같은 지점에 동일한 전화번호를 쓰는 활성 회원이 이미 있습니다.');
    }

    const member: MockMember = {
      id: `member-${randomUUID()}`,
      branchId,
      assignedStaffId: input.assignedStaffId,
      memberNo: this.generateMemberNo(branchId),
      name: input.name,
      phone: input.phone,
      birthDate: input.birthDate,
      gender: input.gender,
      guardianConsent: input.guardianConsent ?? false,
      memo: input.memo,
      status: 'ACTIVE',
      joinedAt: todayKst(),
    };
    this.members.push(member);
    return { member, warnings };
  }

  // 05문서 §6 — 만 19세 미만 판정(생일 지남 여부까지 반영한 만 나이 계산).
  private isMinor(birthDate: string): boolean {
    const dob = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const beforeBirthdayThisYear =
      today.getMonth() < dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
    if (beforeBirthdayThisYear) age--;
    return age < 19;
  }

  // 05문서 §5 PATCH /members/:id — 지점/본인 범위 검증은 컨트롤러가 먼저 마친다.
  updateMember(
    id: string,
    input: Partial<Pick<MockMember, 'name' | 'phone' | 'birthDate' | 'gender' | 'memo' | 'assignedStaffId'>>,
  ): MockMember {
    const member = this.members.find((m) => m.id === id);
    if (!member) {
      throw new AppException('MEMBER_NOT_FOUND', '회원을 찾을 수 없습니다.', 404);
    }
    if (input.assignedStaffId !== undefined) {
      if (input.assignedStaffId) {
        this.assertStaffInBranch(input.assignedStaffId, member.branchId);
      }
      member.assignedStaffId = input.assignedStaffId || undefined;
    }
    if (input.name !== undefined) member.name = input.name;
    if (input.phone !== undefined) member.phone = input.phone;
    if (input.birthDate !== undefined) member.birthDate = input.birthDate;
    if (input.gender !== undefined) member.gender = input.gender;
    if (input.memo !== undefined) member.memo = input.memo;
    return member;
  }

  // 05문서 §5 PATCH /members/:id/status, §6 "탈퇴 시 소프트 삭제 + Account.isActive=false".
  updateMemberStatus(id: string, status: MockMember['status']): MockMember {
    const member = this.members.find((m) => m.id === id);
    if (!member) {
      throw new AppException('MEMBER_NOT_FOUND', '회원을 찾을 수 없습니다.', 404);
    }
    member.status = status;
    // WITHDRAWN이면 잠그고, 그 외(ACTIVE/DORMANT)로 되돌아오면 다시 로그인 가능하게 푼다 —
    // 안 풀면 관리자가 탈퇴를 취소해도 회원이 영구히 로그인 못 하는 상태로 남는다.
    if (member.accountId) {
      const account = this.accounts.find((a) => a.id === member.accountId);
      if (account) account.isActive = status !== 'WITHDRAWN';
    }
    return member;
  }

  findProgramById(id: string): MockProgram | undefined {
    return this.programs.find((p) => p.id === id);
  }

  // 07문서 §5 PATCH /programs/:id/status, §3-2 전이표. 표에 없는 전이(자기 자신 포함)는 409.
  updateProgramStatus(id: string, status: MockProgram['status']): MockProgram {
    const program = this.programs.find((p) => p.id === id);
    if (!program) {
      throw new AppException('PROGRAM_NOT_FOUND', '프로그램을 찾을 수 없습니다.', 404);
    }
    const allowed = PROGRAM_STATUS_TRANSITIONS[program.status];
    if (!allowed.includes(status)) {
      throw new AppException(
        'INVALID_STATUS_TRANSITION',
        `${program.status} 상태에서 ${status}(으)로 전이할 수 없습니다.`,
        409,
      );
    }
    program.status = status;
    return program;
  }

  private assertInstructorInBranch(instructorId: string, branchId: string): void {
    const instructor = this.instructors.find((i) => i.id === instructorId);
    if (!instructor || instructor.branchId !== branchId) {
      throw new AppException(
        'INSTRUCTOR_BRANCH_MISMATCH',
        '강사는 프로그램과 같은 지점 소속이어야 합니다.',
        400,
      );
    }
  }

  // 07문서 §6 — pricingType=FREE_ACCESS는 예약 개념이 없어 price·capacity가 무의미하므로 서버에서도 강제로 비운다
  // (클라이언트가 값을 보내도 무시 — 방어적 검증).
  private normalizeProgramPricing(input: {
    pricingType: MockProgram['pricingType'];
    price: number;
    capacity?: number;
  }): { price: number; capacity?: number } {
    if (input.pricingType === 'FREE_ACCESS') {
      return { price: 0, capacity: undefined };
    }
    return { price: input.price, capacity: input.capacity };
  }

  // 07문서 §5 POST /programs — BRANCH_ADMIN 전용(컨트롤러에서 강제).
  createProgram(
    branchId: string,
    input: {
      name: string;
      category: string;
      ageGroup: MockProgram['ageGroup'];
      description?: string;
      pricingType: MockProgram['pricingType'];
      price: number;
      capacity?: number;
      facilityId?: string;
      instructorId?: string;
      startDate: string;
      endDate?: string;
    },
  ): MockProgram {
    if (input.instructorId) {
      this.assertInstructorInBranch(input.instructorId, branchId);
    }
    const { price, capacity } = this.normalizeProgramPricing(input);
    const program: MockProgram = {
      id: `program-${randomUUID()}`,
      branchId,
      facilityId: input.facilityId,
      instructorId: input.instructorId,
      name: input.name,
      category: input.category,
      ageGroup: input.ageGroup,
      description: input.description,
      pricingType: input.pricingType,
      price,
      capacity,
      status: 'PREPARING',
      startDate: input.startDate,
      endDate: input.endDate,
    };
    this.programs.push(program);
    return program;
  }

  // 07문서 §5 PATCH /programs/:id — 상태는 이 메서드로 바꿀 수 없다(상태 전이 API 전용).
  updateProgram(
    id: string,
    input: Partial<
      Pick<
        MockProgram,
        | 'name'
        | 'category'
        | 'ageGroup'
        | 'description'
        | 'pricingType'
        | 'price'
        | 'capacity'
        | 'facilityId'
        | 'instructorId'
        | 'startDate'
        | 'endDate'
      >
    >,
  ): MockProgram {
    const program = this.findProgramById(id);
    if (!program) {
      throw new AppException('PROGRAM_NOT_FOUND', '프로그램을 찾을 수 없습니다.', 404);
    }
    if (input.instructorId !== undefined) {
      if (input.instructorId) this.assertInstructorInBranch(input.instructorId, program.branchId);
      program.instructorId = input.instructorId || undefined;
    }
    if (input.name !== undefined) program.name = input.name;
    if (input.category !== undefined) program.category = input.category;
    if (input.ageGroup !== undefined) program.ageGroup = input.ageGroup;
    if (input.description !== undefined) program.description = input.description;
    if (input.facilityId !== undefined) program.facilityId = input.facilityId || undefined;
    if (input.startDate !== undefined) program.startDate = input.startDate;
    if (input.endDate !== undefined) program.endDate = input.endDate || undefined;

    const pricingType = input.pricingType ?? program.pricingType;
    const price = input.price ?? program.price;
    const capacity = input.capacity ?? program.capacity;
    const normalized = this.normalizeProgramPricing({ pricingType, price, capacity });
    program.pricingType = pricingType;
    program.price = normalized.price;
    program.capacity = normalized.capacity;

    return program;
  }

  // 07문서 §5 DELETE /programs/:id "삭제(소프트)" — Program은 물리 삭제 대신 이미 있는 status
  // 생애주기의 종결 상태(ENDED)로 전이한다(1-1문서 D9 소프트 삭제 원칙, §3-2 전이표를 그대로 재사용).
  endProgram(id: string): MockProgram {
    return this.updateProgramStatus(id, 'ENDED');
  }

  findInstructorById(id: string): MockInstructor | undefined {
    return this.instructors.find((i) => i.id === id);
  }

  // 07문서 §5 POST /instructors — BRANCH_ADMIN 전용(컨트롤러에서 강제).
  hireInstructor(
    branchId: string,
    input: { name: string; specialty?: string; bio?: string; phone?: string },
  ): MockInstructor {
    const instructor: MockInstructor = {
      id: `instructor-${randomUUID()}`,
      branchId,
      name: input.name,
      specialty: input.specialty,
      bio: input.bio,
      phone: input.phone,
      isActive: true,
    };
    this.instructors.push(instructor);
    return instructor;
  }

  // 07문서 §5 PATCH /instructors/:id.
  updateInstructor(
    id: string,
    input: Partial<Pick<MockInstructor, 'name' | 'specialty' | 'bio' | 'phone' | 'isActive'>>,
  ): MockInstructor {
    const instructor = this.findInstructorById(id);
    if (!instructor) {
      throw new AppException('INSTRUCTOR_NOT_FOUND', '강사를 찾을 수 없습니다.', 404);
    }
    if (input.name !== undefined) instructor.name = input.name;
    if (input.specialty !== undefined) instructor.specialty = input.specialty;
    if (input.bio !== undefined) instructor.bio = input.bio;
    if (input.phone !== undefined) instructor.phone = input.phone;
    if (input.isActive !== undefined) instructor.isActive = input.isActive;
    return instructor;
  }

  // 07문서 §6 — 물리 삭제 대신 소프트 삭제(isActive=false), 기존 연결된 프로그램은 깨지지 않는다.
  deactivateInstructor(id: string): MockInstructor {
    return this.updateInstructor(id, { isActive: false });
  }

  findPostById(id: string): MockPost | undefined {
    return this.posts.find((p) => p.id === id && !p.deletedAt);
  }

  // 04문서 §5 POST /posts — SUPER_ADMIN은 HQ_TO_BRANCH(전체공지 또는 특정 지점 지정 가능),
  // BRANCH_ADMIN은 BRANCH_TO_MEMBER만 작성 가능하고 scope·branchId는 서버가 본인 지점으로 강제한다.
  createPost(
    author: { accountId: string; role: Role; branchId?: string },
    input: { title: string; content: string; category: MockPost['category']; branchId?: string },
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
      const branch = this.findBranchById(author.branchId);
      if (branch?.contractStatus === 'TERMINATED') {
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

  findStaffById(id: string): MockStaff | undefined {
    return this.staff.find((s) => s.id === id);
  }

  // `{최초배치지점코드}-{순번}` — 02문서 §3·§6. 파견 전환이 일어나도 재생성하지 않으므로
  // "이 지점 코드로 이미 발급된 적 있는 staffCode 개수"를 기준으로 순번을 매긴다.
  private generateStaffCode(branchId: string): string {
    const branch = this.findBranchById(branchId);
    const code = branch?.code ?? 'BR';
    const seq = this.staff.filter((s) => s.staffCode.startsWith(`${code}-`)).length + 1;
    return `${code}-${String(seq).padStart(3, '0')}`;
  }

  // 신규 채용 등록 — 02문서 §5 POST /staff, SUPER_ADMIN 전용(컨트롤러에서 강제).
  // Staff는 Account와 1:1이라 로그인 계정도 함께 만들고, 최초 StaffAssignment까지 원자적으로 생성한다.
  hireStaff(
    input: {
      branchId: string;
      name: string;
      email: string;
      phone?: string;
      position?: string;
      employmentType?: string;
      offDays?: number[];
      hireDate?: string;
      note?: string;
    },
    assignedByAccountId: string,
  ): MockStaff {
    const branch = this.findBranchById(input.branchId);
    if (!branch) {
      throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
    }
    if (this.findAccountByEmail(input.email)) {
      throw new AppException('EMAIL_ALREADY_EXISTS', '이미 사용 중인 이메일입니다.', 409);
    }

    const hireDate = input.hireDate ?? todayKst();
    const staffId = `staff-${randomUUID()}`;
    const accountId = `account-${randomUUID()}`;

    this.accounts.push({
      id: accountId,
      email: input.email,
      passwordHash: this.passwordHash,
      role: 'STAFF',
      name: input.name,
      branchId: input.branchId,
      staffId,
    });

    const staff: MockStaff = {
      id: staffId,
      accountId,
      branchId: input.branchId,
      staffCode: this.generateStaffCode(input.branchId),
      name: input.name,
      phone: input.phone,
      position: input.position,
      employmentType: input.employmentType,
      offDays: input.employmentType === '파트타임' ? undefined : input.offDays,
      hireDate,
      status: 'ACTIVE',
    };
    this.staff.push(staff);

    this.staffAssignments.push({
      id: `assignment-${randomUUID()}`,
      staffId,
      branchId: input.branchId,
      startDate: hireDate,
      assignedBy: assignedByAccountId,
      note: input.note,
    });

    return staff;
  }

  // 02문서 §5 PATCH /staff/:id — branchId는 이 메서드로 바꿀 수 없다(파견 발령 API 전용).
  updateStaff(
    id: string,
    input: Partial<Pick<MockStaff, 'name' | 'phone' | 'position' | 'employmentType' | 'offDays'>>,
  ): MockStaff {
    const staff = this.staff.find((s) => s.id === id);
    if (!staff) {
      throw new AppException('STAFF_NOT_FOUND', '직원을 찾을 수 없습니다.', 404);
    }
    if (input.name !== undefined) staff.name = input.name;
    if (input.phone !== undefined) staff.phone = input.phone;
    if (input.position !== undefined) staff.position = input.position;
    if (input.employmentType !== undefined) staff.employmentType = input.employmentType;
    // ATT-T05 — 파트타임은 근태관리 도메인에서 이 필드를 쓰지 않는다(03문서 §3).
    if (input.offDays !== undefined) {
      staff.offDays = staff.employmentType === '파트타임' ? undefined : input.offDays;
    }
    return staff;
  }

  // 02문서 §5 PATCH /staff/:id/resign, §6 — Staff.status + Account.isActive + 활성 StaffAssignment
  // 마감을 한 번에 처리한다(실DB 전환 시 여기가 트랜잭션으로 묶여야 할 지점).
  resignStaff(id: string): MockStaff {
    const staff = this.staff.find((s) => s.id === id);
    if (!staff) {
      throw new AppException('STAFF_NOT_FOUND', '직원을 찾을 수 없습니다.', 404);
    }
    if (staff.status === 'RESIGNED') {
      throw new AppException('STAFF_ALREADY_RESIGNED', '이미 퇴사 처리된 직원입니다.', 409);
    }

    const today = todayKst();
    staff.status = 'RESIGNED';
    staff.resignDate = today;

    const account = this.accounts.find((a) => a.id === staff.accountId);
    if (account) account.isActive = false;

    const activeAssignment = this.staffAssignments.find((a) => a.staffId === id && !a.endDate);
    if (activeAssignment) activeAssignment.endDate = today;

    return staff;
  }

  // 파견 발령(재배치) — 02문서 §5 POST /staff/:id/assignments, §6 불변식(활성 파견 최대 1건).
  // SUPER_ADMIN 전용(컨트롤러에서 강제). 기존 활성 파견을 마감하고 새 파견을 열며 Staff/Account의
  // branchId 캐시도 함께 갱신한다 — 이미 로그인된 세션은 재로그인해야 새 branchId가 반영된다
  // (updateStaffRole과 동일한 제약, 01문서 §3.2).
  assignStaff(id: string, newBranchId: string, assignedByAccountId: string, note?: string): MockStaff {
    const staff = this.staff.find((s) => s.id === id);
    if (!staff) {
      throw new AppException('STAFF_NOT_FOUND', '직원을 찾을 수 없습니다.', 404);
    }
    if (staff.status === 'RESIGNED') {
      throw new AppException('STAFF_ALREADY_RESIGNED', '퇴사한 직원은 재파견할 수 없습니다.', 409);
    }
    const branch = this.findBranchById(newBranchId);
    if (!branch) {
      throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
    }

    const today = todayKst();
    const activeAssignment = this.staffAssignments.find((a) => a.staffId === id && !a.endDate);
    if (activeAssignment) activeAssignment.endDate = today;

    this.staffAssignments.push({
      id: `assignment-${randomUUID()}`,
      staffId: id,
      branchId: newBranchId,
      startDate: today,
      assignedBy: assignedByAccountId,
      note,
    });

    staff.branchId = newBranchId;
    const account = this.accounts.find((a) => a.id === staff.accountId);
    if (account) account.branchId = newBranchId;

    return staff;
  }

  // 02문서 §5 GET /staff/:id/assignments — 최신 파견이 먼저 오도록 정렬.
  staffAssignmentHistory(staffId: string): MockStaffAssignment[] {
    return this.staffAssignments
      .filter((a) => a.staffId === staffId)
      .slice()
      .sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  }

  // ── 03. 근태관리 ──────────────────────────────────────────────────────────

  readonly attendanceRecords: MockAttendanceRecord[] = [];
  readonly leaveRequests: MockLeaveRequest[] = [];
  readonly leaveBalances: MockLeaveBalance[] = [];
  readonly workLogs: MockWorkLog[] = [];

  // 03문서 §6 "자동 지각 판정" — Branch.standardCheckInTime 대비 10분 초과 시 LATE.
  // 체크인 중복 방지(§6): staffId+date로 이미 checkInAt이 있으면 409.
  checkIn(staffId: string): MockAttendanceRecord {
    const staff = this.staff.find((s) => s.id === staffId);
    if (!staff) {
      throw new AppException('STAFF_NOT_FOUND', '직원을 찾을 수 없습니다.', 404);
    }
    const today = new Date();
    const date = todayKst();
    if (this.attendanceRecords.some((r) => r.staffId === staffId && r.date === date && r.checkInAt)) {
      throw new AppException('ALREADY_CHECKED_IN', '오늘 이미 체크인했습니다.', 409);
    }

    const branch = this.findBranchById(staff.branchId);
    const status: AttendanceStatus = this.isLate(today, branch?.standardCheckInTime) ? 'LATE' : 'NORMAL';

    let record = this.attendanceRecords.find((r) => r.staffId === staffId && r.date === date);
    if (record) {
      record.checkInAt = today.toISOString();
      record.status = status;
    } else {
      record = {
        id: `attendance-${randomUUID()}`,
        staffId,
        date,
        checkInAt: today.toISOString(),
        status,
      };
      this.attendanceRecords.push(record);
    }
    return record;
  }

  checkOut(staffId: string): MockAttendanceRecord {
    const date = todayKst();
    const record = this.attendanceRecords.find((r) => r.staffId === staffId && r.date === date);
    if (!record || !record.checkInAt) {
      throw new AppException('NOT_CHECKED_IN', '오늘 체크인 기록이 없습니다.', 400);
    }
    if (record.checkOutAt) {
      throw new AppException('ALREADY_CHECKED_OUT', '오늘 이미 체크아웃했습니다.', 409);
    }
    record.checkOutAt = new Date().toISOString();
    return record;
  }

  // 지점 출근 기준시각(HH:mm) 대비 10분 초과 여부. 지점에 기준시각이 없으면 지각 판정 자체를 하지 않는다.
  // KST 시:분으로 비교한다(서버 프로세스의 로컬 시간대에 의존하던 setHours()는 date-time-handling.md와
  // 같은 이유로 제거 — 배포 환경의 시간대 설정과 무관하게 항상 정확해야 한다).
  private isLate(checkInAt: Date, standardCheckInTime?: string): boolean {
    if (!standardCheckInTime) return false;
    const [h, m] = standardCheckInTime.split(':').map(Number);
    const { hours, minutes } = kstHoursMinutes(checkInAt);
    return hours * 60 + minutes > h * 60 + m + 10;
  }

  // 03문서 §5 GET /attendance/summary — 지점 근태 요약(상태별 집계). month는 "YYYY-MM".
  attendanceSummary(branchId: string, month: string) {
    const staffIds = new Set(this.staff.filter((s) => s.branchId === branchId).map((s) => s.id));
    const records = this.attendanceRecords.filter(
      (r) => staffIds.has(r.staffId) && r.date.startsWith(month),
    );
    return this.staff
      .filter((s) => s.branchId === branchId)
      .map((s) => {
        const own = records.filter((r) => r.staffId === s.id);
        return {
          staffId: s.id,
          name: s.name,
          normal: own.filter((r) => r.status === 'NORMAL').length,
          late: own.filter((r) => r.status === 'LATE').length,
          absent: own.filter((r) => r.status === 'ABSENT').length,
          earlyLeave: own.filter((r) => r.status === 'EARLY_LEAVE').length,
          onLeave: own.filter((r) => r.status === 'ON_LEAVE').length,
        };
      });
  }

  // ADR-ATT-02(domains/근태관리.md) — 오늘이 그 직원의 근무일인지 판정.
  // 파트타임은 근무일이 주 단위로 고정되지 않아 이 판정 자체를 하지 않는다(03문서 §3).
  private isWorkDay(staff: MockStaff, dateStr: string): boolean {
    if (staff.employmentType === '파트타임') return false;
    const dayOfWeek = new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0=일~6=토, UTC 고정 파싱이라 호스트 시간대 무관
    return !(staff.offDays ?? []).includes(dayOfWeek);
  }

  // ADR-ATT-02 — "잠정 결근" 미리보기: 스케줄러 없이 조회 시점에 계산만 하고 저장하지 않는다.
  // 대상: ①재직 중 ②오늘 이전 과거 날짜 ③근무일(파트타임 제외, isWorkDay) ④근태기록 없음(체크인도, 이미
  // 확정된 결근도 아님) ⑤승인된 휴가 기간이 아님. 관리자가 confirmAbsences를 호출해야만 실제로 저장된다.
  previewAbsences(branchId: string, month: string): Array<{ staffId: string; name: string; date: string }> {
    const staffList = this.staff.filter((s) => s.branchId === branchId && s.status === 'ACTIVE');
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const todayStr = todayKst();
    const result: Array<{ staffId: string; name: string; date: string }> = [];

    for (const staff of staffList) {
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${month}-${String(day).padStart(2, '0')}`;
        if (dateStr >= todayStr) continue; // 오늘·미래는 아직 판단하지 않는다
        if (!this.isWorkDay(staff, dateStr)) continue;
        const hasRecord = this.attendanceRecords.some((r) => r.staffId === staff.id && r.date === dateStr);
        if (hasRecord) continue;
        const hasApprovedLeave = this.leaveRequests.some(
          (r) => r.staffId === staff.id && r.status === 'APPROVED' && r.startDate <= dateStr && dateStr <= r.endDate,
        );
        if (hasApprovedLeave) continue;
        result.push({ staffId: staff.id, name: staff.name, date: dateStr });
      }
    }
    return result;
  }

  // ADR-ATT-02 — 결근 확정(BRANCH_ADMIN 명시적 액션, 컨트롤러에서 role 강제). previewAbsences가 이미
  // "근태기록 없음"을 조건으로 걸러 두므로, 확정된 날짜는 다음 호출의 미리보기에서 자연히 빠진다(멱등).
  confirmAbsences(branchId: string, month: string, note?: string): MockAttendanceRecord[] {
    const candidates = this.previewAbsences(branchId, month);
    const created: MockAttendanceRecord[] = candidates.map((c) => ({
      id: `attendance-${randomUUID()}`,
      staffId: c.staffId,
      date: c.date,
      status: 'ABSENT' as AttendanceStatus,
      note: note ?? '결근 확정(관리자 확인)',
    }));
    this.attendanceRecords.push(...created);
    return created;
  }

  // 03문서 §3 "입사연차 기준 자동계산" — 근로기준법 원칙의 단순화: 1년 미만은 11일,
  // 1년 이상은 15일에서 시작해 2년마다 1일 가산(최대 25일). 정밀한 월별 개근 판정은 범위 밖.
  private calcAnnualLeaveTotalDays(hireDate: string, asOfYear: number): number {
    const hire = new Date(hireDate);
    const yearsOfService = asOfYear - hire.getFullYear();
    if (yearsOfService < 1) return 11;
    return Math.min(15 + Math.floor((yearsOfService - 1) / 2), 25);
  }

  // year를 안 주면 올해 기준. 해당 연도 레코드가 아직 없으면 그 자리에서 계산해 생성한다(지연 생성).
  leaveBalance(staffId: string, year?: number): MockLeaveBalance {
    const targetYear = year ?? new Date().getFullYear();
    let balance = this.leaveBalances.find((b) => b.staffId === staffId && b.year === targetYear);
    if (!balance) {
      const staff = this.staff.find((s) => s.id === staffId);
      if (!staff) {
        throw new AppException('STAFF_NOT_FOUND', '직원을 찾을 수 없습니다.', 404);
      }
      balance = {
        staffId,
        year: targetYear,
        totalDays: this.calcAnnualLeaveTotalDays(staff.hireDate, targetYear),
        usedDays: 0,
      };
      this.leaveBalances.push(balance);
    }
    return balance;
  }

  // 03문서 §6 "연차 일수 계산" — 종료일 포함(inclusive), 주말 제외는 Phase 2.
  private calcLeaveDays(startDate: string, endDate: string): number {
    const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.floor(ms / 86_400_000) + 1;
  }

  // 03문서 §6 — 잔여일수 초과 신청도 막지 않고 경고만 반환(마이너스 연차를 관리자 재량으로 승인하는 실무 반영).
  requestLeave(
    staffId: string,
    input: { type: LeaveType; startDate: string; endDate: string; reason?: string },
  ): { request: MockLeaveRequest; warning?: string } {
    const days = this.calcLeaveDays(input.startDate, input.endDate);
    if (days <= 0) {
      throw new AppException('INVALID_DATE_RANGE', '종료일은 시작일 이후여야 합니다.', 400);
    }

    let warning: string | undefined;
    if (input.type === 'ANNUAL') {
      const balance = this.leaveBalance(staffId);
      if (balance.totalDays - balance.usedDays < days) {
        warning = '잔여 연차보다 많은 일수를 신청했습니다. 관리자 재량으로 승인될 수 있습니다.';
      }
    }

    const request: MockLeaveRequest = {
      id: `leave-${randomUUID()}`,
      staffId,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      days,
      reason: input.reason,
      status: 'PENDING',
    };
    this.leaveRequests.push(request);
    return { request, warning };
  }

  private findLeaveRequestOrThrow(id: string): MockLeaveRequest {
    const request = this.leaveRequests.find((r) => r.id === id);
    if (!request) {
      throw new AppException('LEAVE_REQUEST_NOT_FOUND', '휴가 신청을 찾을 수 없습니다.', 404);
    }
    return request;
  }

  // 03문서 §6 — 승인 시점에만 차감(신청만으로는 차감 안 함 → 반려 시 복구 로직 불필요).
  // type=ANNUAL(연차)만 LeaveBalance.usedDays에 반영, SICK/FAMILY_EVENT/OTHER는 이력만 남긴다.
  approveLeaveRequest(id: string, approverId: string): MockLeaveRequest {
    const request = this.findLeaveRequestOrThrow(id);
    if (request.status !== 'PENDING') {
      throw new AppException('LEAVE_REQUEST_ALREADY_REVIEWED', '이미 처리된 휴가 신청입니다.', 409);
    }
    request.status = 'APPROVED';
    request.approverId = approverId;
    request.reviewedAt = new Date().toISOString();

    if (request.type === 'ANNUAL') {
      const balance = this.leaveBalance(request.staffId);
      balance.usedDays += request.days;
    }
    return request;
  }

  rejectLeaveRequest(id: string, approverId: string): MockLeaveRequest {
    const request = this.findLeaveRequestOrThrow(id);
    if (request.status !== 'PENDING') {
      throw new AppException('LEAVE_REQUEST_ALREADY_REVIEWED', '이미 처리된 휴가 신청입니다.', 409);
    }
    request.status = 'REJECTED';
    request.approverId = approverId;
    request.reviewedAt = new Date().toISOString();
    return request;
  }

  // staffId+date 하루 1건 권장(§3) — 같은 날 다시 작성하면 새 글을 추가하지 않고 내용을 덮어쓴다.
  upsertWorkLog(staffId: string, date: string, content: string): MockWorkLog {
    let log = this.workLogs.find((l) => l.staffId === staffId && l.date === date);
    if (log) {
      log.content = content;
    } else {
      log = { id: `worklog-${randomUUID()}`, staffId, date, content, createdAt: new Date().toISOString() };
      this.workLogs.push(log);
    }
    return log;
  }

  findFacilityById(id: string): MockFacility | undefined {
    return this.facilities.find((f) => f.id === id);
  }

  // 08문서 §4 5단계 매핑 — 수동 보정이든 정원 변경이든 currentCount/capacity 비율이 바뀔 때마다 재계산한다.
  private computeCongestionLevel(currentCount: number, capacity: number): number {
    const ratio = (currentCount / capacity) * 100;
    if (ratio <= 20) return 1;
    if (ratio <= 40) return 2;
    if (ratio <= 60) return 3;
    if (ratio <= 80) return 4;
    return 5;
  }

  // 08문서 §6 POST /facilities — BRANCH_ADMIN 전용(컨트롤러에서 강제). capacity 1 이상 필수(§7 나눗셈 오류 방지).
  createFacility(branchId: string, input: { name: string; type: FacilityType; capacity: number }): MockFacility {
    if (input.capacity < 1) {
      throw new AppException('INVALID_CAPACITY', '정원은 1명 이상이어야 합니다.', 400);
    }
    const facility: MockFacility = {
      id: `facility-${randomUUID()}`,
      branchId,
      name: input.name,
      type: input.type,
      capacity: input.capacity,
      currentCount: 0,
      level: 1,
    };
    this.facilities.push(facility);
    return facility;
  }

  // 08문서 §6 PATCH /facilities/:id — 정원이 바뀌면 현재 인원 대비 혼잡도 단계를 즉시 재계산한다.
  updateFacility(
    id: string,
    input: Partial<{ name: string; type: FacilityType; capacity: number }>,
  ): MockFacility {
    const facility = this.findFacilityById(id);
    if (!facility) {
      throw new AppException('FACILITY_NOT_FOUND', '시설을 찾을 수 없습니다.', 404);
    }
    if (input.capacity !== undefined && input.capacity < 1) {
      throw new AppException('INVALID_CAPACITY', '정원은 1명 이상이어야 합니다.', 400);
    }
    if (input.name !== undefined) facility.name = input.name;
    if (input.type !== undefined) facility.type = input.type;
    if (input.capacity !== undefined) {
      facility.capacity = input.capacity;
      facility.level = this.computeCongestionLevel(facility.currentCount, facility.capacity);
    }
    return facility;
  }

  // 08문서 §6 POST /facilities/:id/congestion/manual, §4 "수동 보정"(source=MANUAL) — Phase 1 범위라
  // 별도 CongestionSnapshot 이력 테이블 없이 MockFacility.currentCount/level을 직접 덮어쓴다.
  setManualCongestion(id: string, currentCount: number): MockFacility {
    const facility = this.findFacilityById(id);
    if (!facility) {
      throw new AppException('FACILITY_NOT_FOUND', '시설을 찾을 수 없습니다.', 404);
    }
    if (currentCount < 0) {
      throw new AppException('INVALID_CURRENT_COUNT', '현재 인원은 0명 이상이어야 합니다.', 400);
    }
    facility.currentCount = currentCount;
    facility.level = this.computeCongestionLevel(currentCount, facility.capacity);
    return facility;
  }

  findScheduleSlotById(id: string): MockScheduleSlot | undefined {
    return this.scheduleSlots.find((s) => s.id === id);
  }

  listScheduleSlots(programId: string, date?: string): MockScheduleSlot[] {
    let slots = this.scheduleSlots.filter((s) => s.programId === programId);
    if (date) slots = slots.filter((s) => s.date === date);
    return slots;
  }

  // 06문서 §3 — bookedCount는 캐시 필드를 두지 않고 매번 계산한다(REQUESTED/CONFIRMED만 유효 예약).
  bookedCount(scheduleSlotId: string): number {
    return this.reservations.filter(
      (r) => r.scheduleSlotId === scheduleSlotId && (r.status === 'REQUESTED' || r.status === 'CONFIRMED'),
    ).length;
  }

  // 06문서 §5 POST /programs/:id/slots — BRANCH_ADMIN 전용(컨트롤러에서 강제).
  createScheduleSlot(
    programId: string,
    input: { date: string; startTime: string; endTime: string; capacity?: number },
  ): MockScheduleSlot {
    const program = this.findProgramById(programId);
    if (!program) {
      throw new AppException('PROGRAM_NOT_FOUND', '프로그램을 찾을 수 없습니다.', 404);
    }
    if (program.pricingType !== 'PAID_SESSION') {
      throw new AppException(
        'SLOT_NOT_APPLICABLE',
        '회차 예약형(PAID_SESSION) 프로그램에만 회차를 추가할 수 있습니다.',
        400,
      );
    }
    const capacity = input.capacity ?? program.capacity;
    if (!capacity || capacity < 1) {
      throw new AppException('INVALID_CAPACITY', '정원은 1명 이상이어야 합니다.', 400);
    }
    const slot: MockScheduleSlot = {
      id: `slot-${randomUUID()}`,
      programId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      capacity,
    };
    this.scheduleSlots.push(slot);
    return slot;
  }

  findReservationById(id: string): MockReservation | undefined {
    return this.reservations.find((r) => r.id === id);
  }

  findPaymentByReservationId(reservationId: string): MockPayment | undefined {
    return this.payments.find((p) => p.reservationId === reservationId);
  }

  // 06문서 §6 부가세 분리 — amount(회원이 실제로 낸 금액)에서 공급가액/부가세를 역산한다(부가가치세율 10%).
  private computeVat(amount: number): { supplyAmount: number; vat: number } {
    const supplyAmount = Math.round(amount / 1.1);
    return { supplyAmount, vat: amount - supplyAmount };
  }

  // 06문서 §6 "동시 예약(정원 초과) 방지" — 설계는 Postgres `SELECT ... FOR UPDATE`로 ScheduleSlot 행을
  // 먼저 잠가 팬텀 삽입을 막으라고 명시하지만, MockDataService는 단일 Node 프로세스에서 동기적으로
  // 실행되는 인메모리 배열이라 이 메서드 안에 `await`가 없는 한 두 요청이 실제로 동시에 끼어들 수
  // 없다(자바스크립트 이벤트 루프의 단일 스레드 특성이 곧 그 락 역할을 대신한다) — 그래서 정원 체크와
  // INSERT 사이에 별도 락 코드가 없어도 팬텀 삽입이 발생하지 않는다. 실DB 전환 시에는 문서가 명시한
  // `ScheduleSlot` 행 락을 그대로 적용해야 한다.
  createReservation(memberId: string, scheduleSlotId: string): { reservation: MockReservation; payment?: MockPayment } {
    const slot = this.findScheduleSlotById(scheduleSlotId);
    if (!slot) {
      throw new AppException('SLOT_NOT_FOUND', '회차를 찾을 수 없습니다.', 404);
    }
    const program = this.findProgramById(slot.programId);
    if (!program) {
      throw new AppException('PROGRAM_NOT_FOUND', '프로그램을 찾을 수 없습니다.', 404);
    }
    if (program.pricingType !== 'PAID_SESSION') {
      throw new AppException('NOT_RESERVABLE', '예약 가능한 프로그램이 아닙니다.', 400);
    }
    if (program.status !== 'RUNNING') {
      throw new AppException('PROGRAM_NOT_RUNNING', '진행중인 프로그램이 아닙니다.', 409);
    }
    const branch = this.findBranchById(program.branchId);
    if (branch?.contractStatus === 'TERMINATED') {
      throw new AppException('BRANCH_TERMINATED', '위탁계약이 종료된 지점에는 예약할 수 없습니다.', 409);
    }
    const duplicate = this.reservations.find(
      (r) =>
        r.memberId === memberId &&
        r.scheduleSlotId === scheduleSlotId &&
        (r.status === 'REQUESTED' || r.status === 'CONFIRMED'),
    );
    if (duplicate) {
      throw new AppException('ALREADY_RESERVED', '이미 이 회차를 예약했습니다.', 409);
    }
    if (this.bookedCount(scheduleSlotId) >= slot.capacity) {
      throw new AppException('SLOT_FULL', '정원이 가득 찼습니다.', 409);
    }

    const reservation: MockReservation = {
      id: `reservation-${randomUUID()}`,
      memberId,
      scheduleSlotId,
      status: program.price > 0 ? 'REQUESTED' : 'CONFIRMED',
      createdAt: new Date().toISOString(),
    };
    this.reservations.push(reservation);

    if (program.price <= 0) {
      return { reservation };
    }

    // 서버가 Program 가격을 재조회해 결제금액을 결정한다(클라이언트 금액 신뢰 안 함, §7).
    const payment: MockPayment = {
      id: `payment-${randomUUID()}`,
      reservationId: reservation.id,
      memberId,
      amount: program.price,
      supplyAmount: 0,
      vat: 0,
      method: 'MOCK_CARD',
      status: 'PENDING',
    };
    this.payments.push(payment);
    return { reservation, payment };
  }

  // 06문서 §5 POST /payments/:reservationId/mock-pay — 모의결제 승인.
  mockPay(reservationId: string): { reservation: MockReservation; payment: MockPayment } {
    const reservation = this.findReservationById(reservationId);
    if (!reservation) {
      throw new AppException('RESERVATION_NOT_FOUND', '예약을 찾을 수 없습니다.', 404);
    }
    const payment = this.findPaymentByReservationId(reservationId);
    if (!payment || payment.status !== 'PENDING') {
      throw new AppException('PAYMENT_NOT_PENDING', '결제 대기 상태가 아닙니다.', 409);
    }
    const { supplyAmount, vat } = this.computeVat(payment.amount);
    payment.supplyAmount = supplyAmount;
    payment.vat = vat;
    payment.status = 'APPROVED';
    payment.mockApprovalNo = `MOCK-${randomUUID().slice(0, 8).toUpperCase()}`;
    payment.approvedAt = new Date().toISOString();
    reservation.status = 'CONFIRMED';
    return { reservation, payment };
  }

  // 06문서 §6 취소/환불 정책 — Branch.cancellationDeadlineHours(기본 24시간) 전 취소만 전액 환불.
  cancelReservation(id: string, cancelReason?: string): MockReservation {
    const reservation = this.findReservationById(id);
    if (!reservation) {
      throw new AppException('RESERVATION_NOT_FOUND', '예약을 찾을 수 없습니다.', 404);
    }
    if (reservation.status !== 'REQUESTED' && reservation.status !== 'CONFIRMED') {
      throw new AppException('RESERVATION_NOT_CANCELLABLE', '취소할 수 없는 예약 상태입니다.', 409);
    }

    const payment = this.findPaymentByReservationId(id);
    if (payment && payment.status === 'PENDING') {
      payment.status = 'FAILED';
    } else if (payment && payment.status === 'APPROVED') {
      const slot = this.findScheduleSlotById(reservation.scheduleSlotId);
      const program = slot ? this.findProgramById(slot.programId) : undefined;
      const branch = program ? this.findBranchById(program.branchId) : undefined;
      const deadlineHours = branch?.cancellationDeadlineHours ?? 24;
      const slotStart = slot ? new Date(`${slot.date}T${slot.startTime}:00`) : undefined;
      const withinDeadline =
        slotStart !== undefined && slotStart.getTime() - Date.now() >= deadlineHours * 60 * 60 * 1000;
      if (withinDeadline) {
        payment.status = 'REFUNDED';
        payment.refundedAt = new Date().toISOString();
      }
      // 마감시간 이내 취소는 환불 없이 Payment.status=APPROVED가 그대로 남는다(§6 "환불 불가").
    }

    reservation.status = 'CANCELLED';
    reservation.cancelledAt = new Date().toISOString();
    reservation.cancelReason = cancelReason;
    return reservation;
  }

  // 06문서 §5 PATCH /reservations/:id/check-in — BRANCH_ADMIN 전용(컨트롤러에서 강제).
  checkInReservation(id: string): MockReservation {
    const reservation = this.findReservationById(id);
    if (!reservation) {
      throw new AppException('RESERVATION_NOT_FOUND', '예약을 찾을 수 없습니다.', 404);
    }
    if (reservation.status !== 'CONFIRMED') {
      throw new AppException('RESERVATION_NOT_CONFIRMED', '확정된 예약만 체크인할 수 있습니다.', 409);
    }
    reservation.status = 'COMPLETED';
    return reservation;
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
  }): MockAsset {
    if (!this.findBranchById(input.branchId)) {
      throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
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

  findDocumentById(id: string): MockDocument | undefined {
    return this.documents.find((d) => d.id === id && !d.deletedAt);
  }

  private addYears(date: string, years: number): string {
    return addYearsToDateString(date, years);
  }

  // 1-10문서 §5-6 — HR_RECORD는 근로관계 종료일(없으면 업로드일)+3년, CONTRACT는 관리자 직접 입력
  // (계약 유형마다 법정 기간이 달라 일괄 자동계산 안 함), MANUAL/OTHER는 영구 보관(null).
  private computeRetentionUntil(
    category: DocumentCategory,
    relatedStaffId: string | undefined,
    manualRetentionUntil: string | undefined,
  ): string | undefined {
    if (category === 'CONTRACT') return manualRetentionUntil;
    if (category === 'HR_RECORD') {
      const staff = relatedStaffId ? this.findStaffById(relatedStaffId) : undefined;
      const base = staff?.resignDate ?? todayKst();
      return this.addYears(base, 3);
    }
    return undefined;
  }

  // 1-10문서 §5 POST /documents — 권한·지점 강제는 컨트롤러에서 한다.
  createDocument(
    uploadedBy: string,
    input: {
      category: DocumentCategory;
      branchId?: string;
      relatedStaffId?: string;
      title: string;
      fileUrl: string;
      fileType?: string;
      fileSize?: number;
      retentionUntil?: string;
    },
  ): MockDocument {
    if (input.branchId && !this.findBranchById(input.branchId)) {
      throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
    }
    if (input.category === 'HR_RECORD') {
      if (!input.relatedStaffId) {
        throw new AppException('STAFF_REQUIRED', '인사서류는 대상 직원을 지정해야 합니다.', 400);
      }
      if (!this.findStaffById(input.relatedStaffId)) {
        throw new AppException('STAFF_NOT_FOUND', '직원을 찾을 수 없습니다.', 404);
      }
    }
    const document: MockDocument = {
      id: `doc-${randomUUID()}`,
      category: input.category,
      branchId: input.branchId,
      relatedStaffId: input.category === 'HR_RECORD' ? input.relatedStaffId : undefined,
      title: input.title,
      fileUrl: input.fileUrl,
      fileType: input.fileType,
      fileSize: input.fileSize,
      uploadedBy,
      retentionUntil: this.computeRetentionUntil(input.category, input.relatedStaffId, input.retentionUntil),
      createdAt: new Date().toISOString(),
    };
    this.documents.push(document);
    return document;
  }

  // D9 소프트 삭제 — 계약·인사 분쟁 시 감사 목적으로 복구 가능해야 한다.
  deleteDocument(id: string): void {
    const document = this.findDocumentById(id);
    if (!document) {
      throw new AppException('DOCUMENT_NOT_FOUND', '문서를 찾을 수 없습니다.', 404);
    }
    document.deletedAt = new Date().toISOString();
  }

  // §5-6 — 보존기한이 지난 문서도 자동 삭제하지 않고 경고 대상으로 남긴다(법정 의무는 "최소" 보존기간).
  listRetentionAlerts(withinDays = 30): MockDocument[] {
    const limitStr = toKstDateString(new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000));
    return this.documents
      .filter((d) => !d.deletedAt && d.retentionUntil !== undefined && d.retentionUntil <= limitStr)
      .sort((a, b) => a.retentionUntil!.localeCompare(b.retentionUntil!));
  }
}
