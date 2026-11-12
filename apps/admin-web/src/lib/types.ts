// 각 앱의 응답 타입. 두 앱이 똑같이 쓰는 값 타입은 @sports-erp/web-shared에 한 벌만 둔다(D78).
import type { Role, PricingType, AgeGroup, PaymentStatus, ReservationStatus } from '@sports-erp/web-shared';
export type { Role, PricingType, AgeGroup, PaymentStatus, ReservationStatus };

export type ProgramStatus = 'PREPARING' | 'RUNNING' | 'PAUSED' | 'ENDED';
export type BranchContractStatus = 'ACTIVE' | 'RENEWAL_DUE' | 'EXPIRED' | 'TERMINATED';

export interface AuthUser {
  accountId: string;
  email: string;
  name: string;
  role: Role;
  branchId?: string;
  branchName?: string;
  staffId?: string;
  memberId?: string;
  // D60 3단계 — 지점 관리자·직원의 세부 권한 적용 값(`feature:ACTION` → 허용). 본사·회원은 없다.
  effectivePermissions?: Record<string, boolean>;
  // 보안-6(log/164) — 채용 때 받은 임시 비밀번호를 아직 바꾸지 않았다. 서버가 업무 API를 403으로 막는다.
  mustChangePassword?: boolean;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  // ADR-BRD-02 — 페이지네이션 등 부가 정보(현재는 GET /posts만 사용).
  meta?: { page?: number; pageSize?: number; total?: number };
}

export interface BranchSummary {
  id: string;
  name: string;
  region: string;
  memberCount: number;
  staffCount: number;
  runningProgramCount: number;
  contractStatus: BranchContractStatus;
  // D69 — 계약 값은 진행 중 회차(가장 최근 회차)의 것이다. 종료일은 필수(상시 계약 없음).
  contractRoundNo: number;
  contractStartAt: string;
  contractEndAt: string;
  contractPartner: string;
  // D68 결정 4 — 서버가 조회 때 KST 오늘 기준으로 계산한다. 지난 종료일은 음수.
  contractDaysLeft: number;
  // 상태가 정상인데 종료가 60일 안으로 들어온 지점 — 표시만 하고 상태를 바꾸지는 않는다.
  renewalNotice: boolean;
  // 근태관리 A-6 지각 판정 기준("HH:mm") — 누락일 등록의 출근 시각 기본값(log/199). 없을 수 있다.
  standardCheckInTime: string | null;
  // 진행 중 회차에 지금 붙어 있는 파일(교체된 것 제외)
  hasContractFile: boolean;
  hasTerminationAgreement: boolean;
}

export type ContractFileKind = 'CONTRACT' | 'TERMINATION_AGREEMENT';

// GET /branches/:branchId/contract/rounds — D69 계약 회차(최근 회차부터). 지난 회차·교체된 파일은 읽기 전용.
export interface ContractFileRow {
  id: string;
  kind: ContractFileKind;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedByName: string;
  uploadedAt: string;
  replacedAt?: string;
  // D71 — 보존 끝(회차가 끝난 날 + 3년)·실물 이관·정리
  retentionUntil: string;
  needsArchive: boolean;
  retentionEnded: boolean;
  archivedAt?: string;
  archivedByName?: string;
  purgedAt?: string;
}

// D71 — GET /branches/contract-files/retention(본사)
export interface ContractRetentionRow {
  id: string;
  branchId: string;
  branchName: string;
  roundNo: number;
  kind: ContractFileKind;
  fileName: string;
  replacedAt?: string;
  archivedAt?: string;
  archivedByName?: string;
  retentionUntil: string;
  needsArchive: boolean;
  retentionEnded: boolean;
}

export interface ContractRetentionOverview {
  archiveNeeded: ContractRetentionRow[];
  purgeCandidates: ContractRetentionRow[];
}

export interface ContractRoundRow {
  id: string;
  roundNo: number;
  current: boolean;
  contractPartner: string;
  contractStartAt: string;
  contractEndAt: string;
  terminatedAt?: string;
  createdByName?: string;
  createdAt: string;
  files: ContractFileRow[];
}

// PATCH /branches/:branchId/contract-status 응답(인사정보관리 ADR-STF-07). 종료 전이가 아니면 두 목록은 빈 배열.
export interface ContractStatusChangeResult {
  id: string;
  name: string;
  contractStatus: BranchContractStatus;
  previousStatus: BranchContractStatus;
  reassignmentTargets: Array<{ id: string; staffCode: string; name: string }>;
  unassignedMembers: Array<{ id: string; name: string; staffId: string }>;
}

export interface MemberRow {
  id: string;
  branchId: string;
  branchName?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  memberNo: string;
  name: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
  guardianConsent?: boolean;
  memo?: string;
  status: 'ACTIVE' | 'DORMANT' | 'WITHDRAWN';
  joinedAt: string;
  // ADR-MEM-03 — GET /members/:id 응답에만 포함되는 요약 필드(목록 조회에는 없음).
  enrollmentCount?: number;
  ptRemainingTotal?: number;
  lastPaymentAt?: string;
}

export type CourseEnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export interface CourseEnrollmentRow {
  id: string;
  memberId: string;
  programId: string;
  programName?: string;
  enrolledAt: string;
  expiresAt?: string;
  status: CourseEnrollmentStatus;
}

export interface PTSessionLogRow {
  id: string;
  ptSessionId: string;
  usedAt: string;
  note?: string;
}

export interface PTSessionRow {
  id: string;
  memberId: string;
  programId: string;
  programName?: string;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  reservedSessions?: number; // remainingSessions 중 PT 회차 예약으로 잡힌 횟수(예약및결제 ADR-RSV-09)
  purchasedAt: string;
  logs: PTSessionLogRow[];
}

export interface PermissionStaffRow {
  staffId: string;
  branchId: string;
  branchName: string;
  staffCode: string;
  name: string;
  position?: string;
  role: Extract<Role, 'STAFF' | 'BRANCH_ADMIN'>;
}

export interface StaffRow {
  id: string;
  branchId: string;
  branchName?: string;
  staffCode: string;
  name: string;
  // 목록은 마스킹(ADR-MEM-04), 상세·me는 원문
  phone?: string;
  position?: string;
  employmentType?: string;
  offDays?: number[]; // 0=일~6=토, 파트타임은 쓰지 않음(ATT-T05)
  hireDate: string;
  resignDate?: string;
  status?: 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED';
}

// 파견 이력(인사정보관리 A-3) — endDate가 없으면 지금 파견 중
export interface StaffAssignmentRow {
  id: string;
  staffId: string;
  branchId: string;
  branchName: string;
  startDate: string;
  endDate?: string;
  assignedBy: string;
  note?: string;
}

export interface ProgramRow {
  id: string;
  branchId: string;
  branchName?: string;
  facilityId?: string;
  instructorId?: string;
  name: string;
  category: string;
  ageGroup: AgeGroup;
  description?: string;
  pricingType: PricingType;
  price: number;
  capacity?: number;
  ptPackageSessions?: number; // PT 패키지 1개의 횟수(예약및결제 ADR-RSV-09)
  status: ProgramStatus;
  startDate: string;
  endDate?: string;
  instructorName?: string;
}

// ADR-PRG-02 — PATCH /programs/:id/status 응답에만 포함되는 필드(목록 조회에는 없음).
export interface AffectedReservations {
  count: number;
  items: Array<{
    reservationId: string;
    memberId: string;
    memberName?: string;
    scheduleSlotId: string;
    date: string;
    startTime: string;
  }>;
}

export type PaymentMethod = 'MOCK_CARD';

export interface ScheduleSlotRow {
  id: string;
  programId: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
}

export interface PaymentRow {
  id: string;
  reservationId?: string; // 회차 예약 결제 — 회원 앱 PT 패키지 구매면 없고 ptSessionId(ADR-RSV-09)
  ptSessionId?: string;
  kind?: 'RESERVATION' | 'PT_PACKAGE';
  memberId: string;
  memberName?: string;
  programName?: string;
  branchName?: string;
  amount: number;
  supplyAmount: number;
  vat: number;
  method: PaymentMethod;
  status: PaymentStatus;
  mockApprovalNo?: string;
  approvedAt?: string;
  refundedAt?: string;
}

export interface ReservationRow {
  id: string;
  memberId: string;
  memberName?: string;
  scheduleSlotId: string;
  slot?: ScheduleSlotRow;
  programId?: string;
  programName?: string;
  branchId?: string;
  branchName?: string;
  status: ReservationStatus;
  createdAt: string;
  cancelledAt?: string;
  cancelReason?: string;
  payment?: PaymentRow;
}

export interface InstructorRow {
  id: string;
  branchId: string;
  branchName?: string;
  name: string;
  specialty?: string;
  bio?: string;
  phone?: string;
  isActive: boolean;
}

export interface ProgramStatusSummary {
  branchId: string;
  byStatus: Record<ProgramStatus, number>;
  runningPrograms: ProgramRow[];
}

export type PostCategory = 'NOTICE' | 'TRAINING_MATERIAL' | 'EVENT' | 'OTHER';

export interface PostRow {
  id: string;
  scope: 'HQ_TO_BRANCH' | 'BRANCH_TO_MEMBER';
  branchId?: string;
  branchName?: string;
  authorId: string;
  authorName?: string;
  category: PostCategory;
  title: string;
  content: string;
  viewCount: number;
  publishedAt: string;
  visibleToMember: boolean;
  // 게시판 ADR-BRD-05 — 지점 공지의 대상 시설. 없으면 지점 전체.
  facilityId?: string;
  facilityName?: string;
  // 게시판 ADR-BRD-04 — 상세(GET /posts/:id)에만 실린다.
  attachments?: AttachmentRow[];
}

export interface AttachmentRow {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export type AttendanceStatus = 'NORMAL' | 'LATE' | 'EARLY_LEAVE' | 'ABSENT' | 'ON_LEAVE';
export type LeaveType = 'ANNUAL' | 'SICK' | 'FAMILY_EVENT' | 'OTHER';
export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AttendanceRecordRow {
  id: string;
  staffId: string;
  date: string;
  checkInAt?: string;
  checkOutAt?: string;
  status: AttendanceStatus;
  note?: string;
}

export interface AttendanceSummaryRow {
  staffId: string;
  name: string;
  normal: number;
  late: number;
  absent: number;
  earlyLeave: number;
  onLeave: number;
}

// ADR-ATT-02 — GET /attendance/absence-preview 한 행(저장 전 잠정 결근).
export interface AbsenceCandidateRow {
  staffId: string;
  name: string;
  date: string;
}

export interface LeaveBalanceRow {
  staffId: string;
  year: number;
  totalDays: number;
  usedDays: number;
  // 올해 승인된 휴가의 유형별 사용 일수(근태관리 F3-2, log/133). 한도는 연차에만 있다.
  usedByType?: Record<LeaveType, number>;
}

export interface LeaveRequestRow {
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

export interface WorkLogRow {
  id: string;
  staffId: string;
  date: string;
  content: string;
  createdAt: string;
}

export type FacilityType = 'GYM' | 'POOL' | 'GOLF' | 'READING_ROOM' | 'ETC';

export interface FacilityRow {
  id: string;
  branchId: string;
  branchName?: string;
  name: string;
  type: FacilityType;
  capacity: number;
  currentCount: number; // ADR-FAC-05 — 예약 외 현장 인원(관리자 입력)
  reservedCount: number; // 지금 진행 중인 회차의 확정·체크인 예약 수(조회 때 계산)
  totalCount: number; // 예약 + 현장 — level은 이 값 기준
  level: number;
  lastUpdatedAt: string; // 현장 인원을 마지막으로 입력한 시각
  isActive: boolean;
}

export type AssetCategory = 'EXERCISE_EQUIPMENT' | 'SAFETY_EQUIPMENT' | 'OFFICE_FURNITURE' | 'OTHER';
export type AssetType = 'FIXED_ASSET' | 'CONSUMABLE';
export type AssetStatus = 'NORMAL' | 'REPAIRING' | 'DISPOSAL_PENDING' | 'DISPOSED';
// D69 — 계약서는 문서가 아니라 지점 상세의 계약 회차에서 다룬다(분류 없음).
export type DocumentCategory = 'HR_RECORD' | 'MANUAL' | 'OTHER';

export interface AssetRow {
  id: string;
  assetCode: string;
  branchId: string;
  branchName?: string;
  name: string;
  category: AssetCategory;
  assetType: AssetType;
  acquiredAt: string;
  acquisitionCost: number;
  usefulLifeYears?: number;
  status: AssetStatus;
  quantity: number;
  location?: string;
  note?: string;
}

export interface DocumentRow {
  id: string;
  category: DocumentCategory;
  branchId?: string;
  branchName?: string;
  relatedStaffId?: string;
  relatedStaffName?: string;
  title: string;
  // D69 2차(log/206) — 옛 문서는 외부 주소(fileUrl), 새 문서는 올린 파일(stored·fileName). 열기는 GET /documents/:id/open.
  fileUrl?: string;
  fileName?: string;
  stored?: boolean;
  fileType?: string;
  fileSize?: number;
  uploadedBy: string;
  uploadedByName?: string;
  retentionUntil?: string;
  createdAt: string;
}

// D44 — GET /audit-logs(본사 전용) 한 행. before/after는 바뀐 필드만 담는다. entity는 Staff·Member(D47 열람 기록).
export interface AuditLogRow {
  id: string;
  createdAt: string;
  actorId?: string;
  actorName?: string;
  entity: string;
  entityId: string;
  entityName?: string;
  action: 'ROLE_CHANGED' | 'RESIGNED' | 'ASSIGNED' | 'ASSIGNMENT_ENDED' | 'PHONE_VIEWED' | string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

// 인사정보관리 ADR-STF-09 — 인사 변경 신청(이름·연락처). 신청함 목록의 연락처는 마스킹돼 온다(ADR-MEM-04).
export interface ChangeRequestRow {
  id: string;
  staffId: string;
  staffName?: string;
  field: 'name' | 'phone';
  oldValue?: string;
  newValue: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

// D56 — 업무지원 요청(현장 → 본사).
export type SupportCategory = 'FACILITY' | 'STAFFING' | 'SUPPLIES' | 'IT' | 'OTHER';
export type SupportStatus = 'REQUESTED' | 'IN_PROGRESS' | 'DONE' | 'REJECTED';

export interface SupportRequestRow {
  id: string;
  branchId: string;
  branchName?: string;
  requesterId: string;
  requesterName?: string;
  category: SupportCategory;
  title: string;
  content: string;
  status: SupportStatus;
  handlerId?: string;
  handlerName?: string;
  response?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// log/125 F3 — GET /branches/:branchId/performance(api branch-performance.ts와 같은 모양)
export interface MonthlyPerformance {
  month: string;
  revenue: number;
  refunded: number;
  reservations: number;
  completed: number;
  newMembers: number;
}

// D75 — GET /branches/performance(본사): 전사 월별 추이 + 지난달 지점별 순매출(큰 것부터).
export interface CompanyPerformance {
  trend: MonthlyPerformance[];
  byBranch: { month: string; rows: Array<{ branchId: string; branchName: string; contractStatus: BranchContractStatus; revenue: number }> };
}

// D60 — 세부 권한(권한관리 ADR-AUTH-07). GET /permissions/catalog·/permissions/roles·/permissions/staff/:id/overrides
export type PermissionAction = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT';
export type GovernedRole = 'BRANCH_ADMIN' | 'STAFF';

export interface PermissionCatalog {
  roles: GovernedRole[];
  actions: { action: PermissionAction; label: string }[];
  features: { feature: string; label: string; ceiling: Partial<Record<GovernedRole, PermissionAction[]>> }[];
}

export interface RolePermissionCell {
  feature: string;
  action: PermissionAction;
  allowed: boolean;
}

export interface StaffPermissionMatrix {
  staffId: string;
  role: Role;
  cells: { feature: string; action: PermissionAction; roleDefault: boolean; override: boolean | null; effective: boolean }[];
}

// D61 — 처리 대기함 항목(GET /inbox). link는 처리할 화면 경로.
export interface InboxItem {
  key: string;
  label: string;
  count: number;
  link: string;
}
