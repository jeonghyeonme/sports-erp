// Phase 1 스캐폴딩 단계의 인메모리 더미 데이터 타입 정의.
// 실제 DB(Prisma) 연동 전까지 apps/api 전체가 이 타입들을 기준으로 동작합니다.
// 필드 구성은 prisma/schema.prisma를 최대한 그대로 따릅니다 — 나중에 MockDataService를
// PrismaService 기반 리포지토리로 교체할 때 컨트롤러 코드는 거의 손대지 않아도 되도록 하기 위함입니다.

export type Role = 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'STAFF' | 'MEMBER';
export type ProgramStatus = 'PREPARING' | 'RUNNING' | 'PAUSED' | 'ENDED';
export type PricingType = 'FREE_ACCESS' | 'PAID_SESSION' | 'PT_PACKAGE';
export type AgeGroup = 'ALL' | 'CHILD' | 'TEEN' | 'ADULT' | 'SENIOR';
export type PostScope = 'HQ_TO_BRANCH' | 'BRANCH_TO_MEMBER';
export type PostCategory = 'NOTICE' | 'TRAINING_MATERIAL' | 'EVENT' | 'OTHER';
export type BranchContractStatus = 'ACTIVE' | 'RENEWAL_DUE' | 'EXPIRED' | 'TERMINATED';
export type StaffStatus = 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED';
export type AttendanceStatus = 'NORMAL' | 'LATE' | 'EARLY_LEAVE' | 'ABSENT' | 'ON_LEAVE';
export type LeaveType = 'ANNUAL' | 'SICK' | 'FAMILY_EVENT' | 'OTHER';
export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type FacilityType = 'GYM' | 'POOL' | 'GOLF' | 'READING_ROOM' | 'ETC';
export type ReservationStatus = 'REQUESTED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
export type PaymentMethod = 'MOCK_CARD';
export type PaymentStatus = 'PENDING' | 'APPROVED' | 'FAILED' | 'REFUNDED';
export type AssetCategory = 'EXERCISE_EQUIPMENT' | 'SAFETY_EQUIPMENT' | 'OFFICE_FURNITURE' | 'OTHER';
export type AssetType = 'FIXED_ASSET' | 'CONSUMABLE';
export type AssetStatus = 'NORMAL' | 'REPAIRING' | 'DISPOSAL_PENDING' | 'DISPOSED';
export type DocumentCategory = 'CONTRACT' | 'HR_RECORD' | 'MANUAL' | 'OTHER';

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
  offDays?: number[]; // 정기 휴무 요일(0=일~6=토). employmentType=파트타임은 사용 안 함 — 03문서 §3, ATT-T05
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
  branchId: string; // ADR-ATT-03(domains/근태관리.md) — 기록 시점(체크인 당시/결근 확정 대상일)의 소속 지점
  // 스냅샷. Staff.branchId(현재 파견 지점)를 그때그때 참조하면 월중 파견 이동 시 과거 기록이 소급 왜곡된다.
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

// 07문서 §3 Instructor — 2026-09-18까지는 Program.instructorName 문자열 비정규화로 대체돼 있었으나
// (당시엔 "존재하지 않는 엔티티를 가리키는 매달린 FK를 만들지 않기 위한 의도적 단순화"), 이제 엔티티가
// 생겼으므로 Program은 이 엔티티를 instructorId(FK)로 가리킨다.
export interface MockInstructor {
  id: string;
  branchId: string;
  name: string;
  specialty?: string; // 전문분야(요가/필라테스/수영/골프 등)
  bio?: string;
  photoUrl?: string;
  phone?: string;
  isActive: boolean;
}

export interface MockProgram {
  id: string;
  branchId: string;
  facilityId?: string; // FK → MockFacility. 08문서 참고
  instructorId?: string; // FK → MockInstructor, nullable
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
}

// 06문서 §3 ScheduleSlot(프로그램 회차) — PAID_SESSION 프로그램만 대상(FREE_ACCESS는 회차 개념이 없음).
export interface MockScheduleSlot {
  id: string;
  programId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;
  capacity: number;
}

// 06문서 §3 Reservation. bookedCount는 캐시 필드를 두지 않고 매번
// Reservation(scheduleSlotId, status IN REQUESTED/CONFIRMED) 카운트로 계산한다(§6).
export interface MockReservation {
  id: string;
  memberId: string;
  scheduleSlotId: string;
  status: ReservationStatus;
  createdAt: string;
  cancelledAt?: string;
  cancelReason?: string;
}

// 06문서 §3 Payment — PT_PACKAGE 구매 결제(ptSessionId)는 PTSession 엔티티 자체가 아직 없어
// 이번 범위에서 제외한다(회원관리 PT세션 백엔드와 함께 보류, 2-3문서 참고). reservationId만 사용.
export interface MockPayment {
  id: string;
  reservationId: string;
  memberId: string;
  amount: number; // 실 결제금액(공급가액+부가세)
  supplyAmount: number; // round(amount / 1.1)
  vat: number; // amount - supplyAmount
  method: PaymentMethod;
  status: PaymentStatus;
  mockApprovalNo?: string;
  approvedAt?: string;
  refundedAt?: string;
}

// 1-10문서 §4-3 Asset — bookValue(감가상각 장부가액)는 연 1회 배치(Phase 2)라 이번 범위에서 제외.
export interface MockAsset {
  id: string;
  assetCode: string; // {지점코드}-A{순번}
  branchId: string;
  name: string;
  category: AssetCategory;
  assetType: AssetType;
  acquiredAt: string;
  acquisitionCost: number;
  usefulLifeYears?: number; // FIXED_ASSET만 사용
  status: AssetStatus;
  quantity: number; // CONSUMABLE은 재고 수량, FIXED_ASSET은 항상 1
  location?: string;
  note?: string;
}

// 1-10문서 §5-3 Document — fileUrl은 문자열 필드일 뿐 실제 파일 업로드 인프라는 아직 없다.
export interface MockDocument {
  id: string;
  category: DocumentCategory;
  branchId?: string; // 전사 문서면 undefined(=null)
  relatedStaffId?: string; // HR_RECORD 대상 직원
  title: string;
  fileUrl: string;
  fileType?: string;
  fileSize?: number;
  uploadedBy: string; // FK → MockAccount
  retentionUntil?: string; // undefined = 영구 보관
  createdAt: string;
  deletedAt?: string; // 소프트 삭제(D9)
}

export interface MockPost {
  id: string;
  scope: PostScope;
  branchId?: string; // scope=HQ_TO_BRANCH이고 전체공지면 undefined(=null)
  authorId: string; // FK → MockAccount — "작성자 본인만 수정" 권한 판단에 사용(04문서 §5)
  category: PostCategory;
  title: string;
  content: string;
  viewCount: number;
  publishedAt: string;
  deletedAt?: string; // 소프트 삭제(04문서 §6)
  // ADR-BRD-01 — HQ_TO_BRANCH 공지를 회원에게도 보여줄지. 기본 false(안전 측 우선).
  // BRANCH_TO_MEMBER는 scope 자체로 이미 회원에게 노출되므로 이 필드와 무관하게 항상 true로 저장한다.
  visibleToMember: boolean;
}

export interface MockFacility {
  id: string;
  branchId: string;
  name: string;
  type: FacilityType;
  capacity: number;
  currentCount: number;
  level: number; // 1~5, currentCount/capacity 비율로 계산(08문서 §4). MANUAL 보정 시에도 즉시 재계산.
  // ADR-FAC-01 — currentCount/level이 마지막으로 갱신된 시각(수동 보정 시점). RFP F08b(30분 이내 반영) 검증용.
  lastUpdatedAt: string;
}
