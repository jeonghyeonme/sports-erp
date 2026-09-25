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
  position?: string;
  employmentType?: string;
  hireDate: string;
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
