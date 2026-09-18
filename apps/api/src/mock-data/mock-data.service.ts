import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  AttendanceStatus,
  LeaveType,
  MockAccount,
  MockAttendanceRecord,
  MockBranch,
  MockFacility,
  MockInstructor,
  MockLeaveBalance,
  MockLeaveRequest,
  MockMember,
  MockPost,
  MockProgram,
  MockRefreshToken,
  MockStaff,
  MockStaffAssignment,
  MockWorkLog,
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
      commissionRate: 0.6,
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
      joinedAt: new Date().toISOString().slice(0, 10),
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
    input: { name: string; specialty?: string; bio?: string; phone?: string; commissionRate?: number },
  ): MockInstructor {
    const instructor: MockInstructor = {
      id: `instructor-${randomUUID()}`,
      branchId,
      name: input.name,
      specialty: input.specialty,
      bio: input.bio,
      phone: input.phone,
      commissionRate: input.commissionRate,
      isActive: true,
    };
    this.instructors.push(instructor);
    return instructor;
  }

  // 07문서 §5 PATCH /instructors/:id.
  updateInstructor(
    id: string,
    input: Partial<Pick<MockInstructor, 'name' | 'specialty' | 'bio' | 'phone' | 'commissionRate' | 'isActive'>>,
  ): MockInstructor {
    const instructor = this.findInstructorById(id);
    if (!instructor) {
      throw new AppException('INSTRUCTOR_NOT_FOUND', '강사를 찾을 수 없습니다.', 404);
    }
    if (input.name !== undefined) instructor.name = input.name;
    if (input.specialty !== undefined) instructor.specialty = input.specialty;
    if (input.bio !== undefined) instructor.bio = input.bio;
    if (input.phone !== undefined) instructor.phone = input.phone;
    if (input.commissionRate !== undefined) instructor.commissionRate = input.commissionRate;
    if (input.isActive !== undefined) instructor.isActive = input.isActive;
    return instructor;
  }

  // 07문서 §6 — 물리 삭제 대신 소프트 삭제(isActive=false), 기존 연결된 프로그램은 깨지지 않는다.
  deactivateInstructor(id: string): MockInstructor {
    return this.updateInstructor(id, { isActive: false });
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

    const hireDate = input.hireDate ?? new Date().toISOString().slice(0, 10);
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
    input: Partial<Pick<MockStaff, 'name' | 'phone' | 'position' | 'employmentType'>>,
  ): MockStaff {
    const staff = this.staff.find((s) => s.id === id);
    if (!staff) {
      throw new AppException('STAFF_NOT_FOUND', '직원을 찾을 수 없습니다.', 404);
    }
    if (input.name !== undefined) staff.name = input.name;
    if (input.phone !== undefined) staff.phone = input.phone;
    if (input.position !== undefined) staff.position = input.position;
    if (input.employmentType !== undefined) staff.employmentType = input.employmentType;
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

    const today = new Date().toISOString().slice(0, 10);
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

    const today = new Date().toISOString().slice(0, 10);
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
    const date = today.toISOString().slice(0, 10);
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
    const date = new Date().toISOString().slice(0, 10);
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
  private isLate(checkInAt: Date, standardCheckInTime?: string): boolean {
    if (!standardCheckInTime) return false;
    const [h, m] = standardCheckInTime.split(':').map(Number);
    const standard = new Date(checkInAt);
    standard.setHours(h, m + 10, 0, 0);
    return checkInAt > standard;
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
}
