// TODO: packages/types(@sports-erp/types)로 옮겨 admin-web/member-app/api가 공유하도록 통합 예정.
// 지금은 Vite 워크스페이스 심볼릭 링크 해석 이슈를 피하기 위해 admin-web 안에 로컬로 둡니다.

export type Role = 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'STAFF' | 'MEMBER';
export type ProgramStatus = 'PREPARING' | 'RUNNING' | 'PAUSED' | 'ENDED';
export type PricingType = 'FREE_ACCESS' | 'PAID_SESSION' | 'PT_PACKAGE';
export type AgeGroup = 'ALL' | 'CHILD' | 'TEEN' | 'ADULT' | 'SENIOR';
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
  contractStartAt?: string;
  contractEndAt?: string;
  contractPartner?: string;
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

export type ReservationStatus = 'REQUESTED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
export type PaymentMethod = 'MOCK_CARD';
export type PaymentStatus = 'PENDING' | 'APPROVED' | 'FAILED' | 'REFUNDED';

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
  reservationId: string;
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
  currentCount: number;
  level: number;
  lastUpdatedAt: string;
  isActive: boolean;
}

export type AssetCategory = 'EXERCISE_EQUIPMENT' | 'SAFETY_EQUIPMENT' | 'OFFICE_FURNITURE' | 'OTHER';
export type AssetType = 'FIXED_ASSET' | 'CONSUMABLE';
export type AssetStatus = 'NORMAL' | 'REPAIRING' | 'DISPOSAL_PENDING' | 'DISPOSED';
export type DocumentCategory = 'CONTRACT' | 'HR_RECORD' | 'MANUAL' | 'OTHER';

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
  fileUrl: string;
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
