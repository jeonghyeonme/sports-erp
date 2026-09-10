import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  MockAccount,
  MockBranch,
  MockFacility,
  MockMember,
  MockPost,
  MockProgram,
  MockStaff,
  MockStaffAssignment,
  Role,
} from './mock-data.types';
import { generateLightBranches } from './branch-generator';
import { AppException } from '../common/exceptions/app.exception';

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
    ...this.generated.members,
  ];

  readonly programs: MockProgram[] = [
    {
      id: 'program-seocho-yoga',
      branchId: 'branch-seocho',
      facilityId: 'facility-seocho-gym',
      name: '아침 요가',
      category: '요가',
      ageGroup: 'ADULT',
      description: '기초 체력과 유연성을 함께 기르는 아침 요가 클래스입니다.',
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
      facilityId: 'facility-seocho-gym',
      name: '퍼스널 트레이닝',
      category: 'PT',
      ageGroup: 'ADULT',
      description: '1:1 맞춤 트레이닝 프로그램(세션 차감형).',
      pricingType: 'PT_PACKAGE',
      price: 60000,
      status: 'RUNNING',
      startDate: '2026-01-05',
      instructorName: '박서연',
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
      name: '필라테스 (10월 개강 예정)',
      category: '필라테스',
      ageGroup: 'ADULT',
      description: '10월 개강 예정인 소규모 필라테스 클래스입니다.',
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
      memo: input.memo,
      status: 'ACTIVE',
      joinedAt: new Date().toISOString().slice(0, 10),
    };
    this.members.push(member);
    return { member, warnings };
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
}
