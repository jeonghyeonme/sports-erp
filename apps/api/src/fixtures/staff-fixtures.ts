import { generateLightBranches } from './branch-generator';
import { MockStaff, MockStaffAssignment, Role } from './mock-data.types';

/**
 * 직원·파견·관리자 계정의 시드 원천 — D30. 원천은 DB이고, prisma/seed.ts만 이 목록을 쓴다.
 * mock은 앱이 뜰 때 DB에서 미러를 채우므로(StaffService.onModuleInit) 이 파일을 직접 읽지 않는다.
 *
 * 히어로 계정·직원 id는 예전 mock 값 그대로다(`account-minsu`, `staff-seoyeon` 등). 아직 mock인 도메인의
 * 시드 데이터(회원 담당 직원 등)가 이 id를 가리키므로 바꾸면 안 된다(CLAUDE.md "데모 계정은 mock과 id를 맞출 것").
 */
export interface StaffAccountRecord {
  id: string;
  email: string;
  role: Extract<Role, 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'STAFF'>;
  name: string;
}

const HERO_ACCOUNTS: readonly StaffAccountRecord[] = [
  { id: 'account-haneul', email: 'jeong.haneul@spoism.example', role: 'SUPER_ADMIN', name: '정하늘' },
  { id: 'account-minsu', email: 'kim.minsu@spoism.example', role: 'BRANCH_ADMIN', name: '김민수' },
  { id: 'account-seoyeon', email: 'park.seoyeon@spoism.example', role: 'STAFF', name: '박서연' },
  // 강남점 관리자 — 지점 격리 동작을 시연하는 계정(예전엔 mock에만 있었다).
  { id: 'account-gangnam-admin', email: 'choi.gangnam@spoism.example', role: 'BRANCH_ADMIN', name: '최강남' },
];

const HERO_STAFF: readonly MockStaff[] = [
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
];

export interface StaffSeed {
  accounts: StaffAccountRecord[];
  staff: MockStaff[];
  assignments: MockStaffAssignment[];
}

/**
 * 시드가 DB에 넣는 직원 전체(히어로 3 + 생성 192)와 그 계정·최초 파견.
 * 생성 직원은 mock 시절 계정 id만 있고 계정 레코드가 없었다 — D30에서 계정을 새로 만든다
 * (`staff-gen-001-1` → `gen-001-1@staff.spoism.example`, 역할 STAFF, 데모 비밀번호).
 */
export function staffSeed(): StaffSeed {
  const dataset = generateLightBranches();
  const generated = dataset.staff;
  // 인사정보관리 ADR-STF-07 — 계약 종료 지점의 파견은 종료 전이 때 끝났어야 하므로 계약 종료일로 닫아 둔다(log/103).
  // 이 직원들은 활성 파견이 없는 재직 직원 = 재배치 대기로 보인다.
  const terminatedEndAt = new Map(
    dataset.branches.filter((b) => b.contractStatus === 'TERMINATED').map((b) => [b.id, b.contractEndAt]),
  );
  const staff = [...HERO_STAFF, ...generated];
  const accounts = [
    ...HERO_ACCOUNTS,
    ...generated.map<StaffAccountRecord>((s) => ({
      id: s.accountId,
      email: `${s.id.replace(/^staff-/, '')}@staff.spoism.example`,
      role: 'STAFF',
      name: s.name,
    })),
  ];
  // 인사정보관리 A-3 "신규 등록 시 최초 StaffAssignment 자동 생성"을 시드에도 적용 — 모든 직원이 활성 파견 1건으로 시작한다.
  const assignments = staff.map<MockStaffAssignment>((s) => ({
    id: `assignment-${s.id}`,
    staffId: s.id,
    branchId: s.branchId,
    startDate: s.hireDate,
    endDate: terminatedEndAt.get(s.branchId),
    assignedBy: 'account-haneul',
  }));
  return { accounts, staff, assignments };
}
