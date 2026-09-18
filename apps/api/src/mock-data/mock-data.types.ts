// Phase 1 스캐폴딩 단계의 인메모리 더미 데이터 타입 정의.
// 실제 DB(Prisma) 연동 전까지 apps/api 전체가 이 타입들을 기준으로 동작합니다.
// 필드 구성은 prisma/schema.prisma를 최대한 그대로 따릅니다 — 나중에 MockDataService를
// PrismaService 기반 리포지토리로 교체할 때 컨트롤러 코드는 거의 손대지 않아도 되도록 하기 위함입니다.

export type Role = 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'STAFF' | 'MEMBER';
export type ProgramStatus = 'PREPARING' | 'RUNNING' | 'PAUSED' | 'ENDED';
export type PricingType = 'FREE_ACCESS' | 'PAID_SESSION' | 'PT_PACKAGE';
export type AgeGroup = 'ALL' | 'CHILD' | 'TEEN' | 'ADULT' | 'SENIOR';
export type PostScope = 'HQ_TO_BRANCH' | 'BRANCH_TO_MEMBER';
export type BranchContractStatus = 'ACTIVE' | 'RENEWAL_DUE' | 'EXPIRED' | 'TERMINATED';
export type StaffStatus = 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED';
export type AttendanceStatus = 'NORMAL' | 'LATE' | 'EARLY_LEAVE' | 'ABSENT' | 'ON_LEAVE';
export type LeaveType = 'ANNUAL' | 'SICK' | 'FAMILY_EVENT' | 'OTHER';
export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface MockBranch {
  id: string;
  name: string;
  address?: string;
  region: string; // 광역 단위(예: "서울", "경기") — 대시보드에서 지점을 지역별로 묶어 보여주는 데 사용
  code: string; // 지점 코드 — staffCode/memberNo 생성에 사용(예: "SEOCHO"). 01문서 §2-1
  standardCheckInTime?: string; // "HH:mm" — 03문서 지각 판정 기준
  cancellationDeadlineHours?: number; // 예약 무료취소 기준 시간(예: 24) — 01문서 §2-1 cancellationPolicy, 06문서 §6
  // 위탁계약 필드 — 01문서 §2-1. Branch는 매장이 아니라 위탁운영 계약 현장이라는 재해석의 핵심 데이터.
  contractPartner: string;
  contractStartAt: string;
  contractEndAt?: string;
  contractStatus: BranchContractStatus;
}

// 01문서 §3 RefreshToken — 원문 대신 해시로 저장, 로그아웃/rotate 시 revokedAt만 채운다(물리삭제 안 함).
export interface MockRefreshToken {
  id: string; // JWT의 jti(리프레시 토큰 고유 id)와 동일
  accountId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface MockAccount {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  name: string;
  isActive?: boolean; // 미설정=활성. 회원 탈퇴/직원 퇴사 시 false로 전환(05문서 §6, 01문서 §3.2)
  // 실제 스키마에서는 Account에 branchId가 없고 Staff/Member를 거쳐 조회하지만,
  // 더미 데이터에서는 조회 편의를 위해 비정규화해서 들고 있습니다.
  branchId?: string;
  staffId?: string;
  memberId?: string;
}

export interface MockStaff {
  id: string;
  accountId: string;
  branchId: string; // **현재 파견 지점**(비정규화 캐시) — 원천은 MockStaffAssignment. 02문서 §3
  staffCode: string;
  name: string;
  phone?: string;
  position?: string;
  employmentType?: string;
  hireDate: string;
  resignDate?: string;
  status: StaffStatus;
}

// 파견 이력 — 01문서 §2-2, 02문서 §3. endDate=undefined인 레코드가 직원당 항상 최대 1건이어야
// 한다는 불변식은 MockDataService.assignStaff/resignStaff가 보장한다.
export interface MockStaffAssignment {
  id: string;
  staffId: string;
  branchId: string;
  startDate: string;
  endDate?: string; // undefined = 현재 진행 중인 파견
  assignedBy: string; // FK → MockAccount.id, 항상 SUPER_ADMIN
  note?: string;
}

// 03문서 §3 AttendanceRecord — staffId+date가 하루 1레코드(unique).
export interface MockAttendanceRecord {
  id: string;
  staffId: string;
  date: string; // YYYY-MM-DD
  checkInAt?: string; // ISO datetime
  checkOutAt?: string;
  status: AttendanceStatus;
  note?: string;
}

// 03문서 §3 LeaveRequest.
export interface MockLeaveRequest {
  id: string;
  staffId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: LeaveRequestStatus;
  approverId?: string;
  reviewedAt?: string;
}

// 03문서 §3 LeaveBalance — type=ANNUAL(연차)만 이 잔여일수에 반영된다. staffId+year가 1건.
export interface MockLeaveBalance {
  staffId: string;
  year: number;
  totalDays: number;
  usedDays: number;
}

// 03문서 §3 WorkLog — staffId+date가 하루 1건 권장(수정은 허용).
export interface MockWorkLog {
  id: string;
  staffId: string;
  date: string;
  content: string;
  createdAt: string;
}

export interface MockMember {
  id: string;
  accountId?: string;
  branchId: string;
  assignedStaffId?: string; // 담당 트레이너 등(선택) — 없으면 회원권만 등록하고 담당 직원이 없는 회원
  memberNo: string;
  name: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
  status: 'ACTIVE' | 'DORMANT' | 'WITHDRAWN';
  joinedAt: string;
  guardianConsent: boolean; // default false — 미성년 회원의 법정대리인 동의 여부. 05문서 §3, §6
  memo?: string; // 관리자 메모(특이사항). 05문서 §3
}

export interface MockProgram {
  id: string;
  branchId: string;
  facilityId?: string; // FK → MockFacility. 08문서 참고
  name: string;
  category: string;
  ageGroup: AgeGroup; // 01문서가 인용하는 원본 RFP "연령대별 리스트" 요건. 07문서 §3
  description?: string;
  pricingType: PricingType;
  price: number;
  capacity?: number;
  status: ProgramStatus;
  startDate: string;
  endDate?: string; // 종료 예정일 — 상시 운영이면 undefined(=null). 07문서 §3
  // instructorId(FK)가 아니라 이름 문자열로 비정규화 — 별도 Instructor mock 엔티티가
  // 아직 없어서(2-3문서 §2-2 참고), 존재하지 않는 엔티티를 가리키는 매달린 FK를 만들지 않기 위한 의도적 단순화
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
