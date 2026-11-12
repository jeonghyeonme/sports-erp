// 각 앱의 응답 타입. 두 앱이 똑같이 쓰는 값 타입은 @sports-erp/web-shared에 한 벌만 둔다(D78).
// 형태는 api의 RequestUser·공통 응답 envelope(system-overview §4)과 맞춘다.
import type { Role, PricingType, AgeGroup, PaymentStatus, ReservationStatus } from '@sports-erp/web-shared';
export type { Role, PricingType, AgeGroup, PaymentStatus, ReservationStatus };

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
  meta?: Record<string, unknown>;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends SessionTokens {
  user: AuthUser;
}

// ── 조회·예약·결제(B1-2) — api 응답 형식(fixtures/mock-data.types.ts의 Mock*)에서 화면이 쓰는 필드만 ──



export interface Program {
  id: string;
  branchId: string;
  name: string;
  category: string;
  ageGroup: AgeGroup;
  description?: string;
  pricingType: PricingType;
  price: number; // PT_PACKAGE는 패키지 1개 가격
  capacity?: number;
  ptPackageSessions?: number; // PT 패키지 1개의 횟수 — 있으면 앱에서 살 수 있다(예약및결제 ADR-RSV-09)
  status: string;
  instructorName?: string;
  instructorSpecialty?: string;
  instructorBio?: string;
}

export interface ScheduleSlot {
  id: string;
  programId: string;
  date: string; // KST YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;
  capacity: number;
}

export interface SlotWithCount extends ScheduleSlot {
  bookedCount: number;
}


export interface Payment {
  id: string;
  reservationId: string;
  amount: number;
  status: PaymentStatus;
  mockApprovalNo?: string;
  approvedAt?: string;
  refundedAt?: string;
}

export interface Reservation {
  id: string;
  scheduleSlotId: string;
  status: ReservationStatus;
  createdAt: string;
  cancelledAt?: string;
  slot?: ScheduleSlot;
  programId?: string;
  programName?: string;
  branchName?: string;
  payment?: Payment;
  ptSessionId?: string; // PT 회차 예약 — 결제 대신 PT 패키지 1회를 잡았다(ADR-RSV-09)
}

// ── 공지·혼잡도·내 정보(B1-3) ──

export interface Facility {
  id: string;
  name: string;
  type: 'GYM' | 'POOL' | 'GOLF' | 'READING_ROOM' | 'ETC';
  capacity: number;
  currentCount: number; // ADR-FAC-05 — 예약 외 현장 인원(지점 입력)
  reservedCount: number; // 지금 진행 중인 강습의 확정·체크인 예약 수
  totalCount: number; // 예약 + 현장 — level은 이 값 기준
  level: number; // 1~5(혼잡도관리 A-6)
  lastUpdatedAt: string; // ADR-FAC-01 — 현장 인원을 마지막으로 입력한 시각
}

export interface Post {
  id: string;
  scope: 'HQ_TO_BRANCH' | 'BRANCH_TO_MEMBER';
  category: 'NOTICE' | 'TRAINING_MATERIAL' | 'EVENT' | 'OTHER';
  title: string;
  content: string;
  publishedAt: string;
  branchName?: string;
  facilityName?: string; // 지점 공지의 대상 시설(게시판 ADR-BRD-05). 없으면 지점 전체
  attachments?: Attachment[]; // 상세 응답에만 있다(게시판 ADR-BRD-04)
}

export interface Attachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface MemberProfile {
  id: string;
  memberNo: string;
  name: string;
  phone?: string;
  status: 'ACTIVE' | 'DORMANT' | 'WITHDRAWN';
  joinedAt: string;
  branchName?: string;
  // ADR-MEM-03 — 상세 조회가 함께 주는 요약
  enrollmentCount?: number;
  ptRemainingTotal?: number;
}

export interface Enrollment {
  id: string;
  programName?: string;
  enrolledAt: string;
  expiresAt?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

export interface PTPackage {
  id: string;
  programId: string;
  programName?: string;
  totalSessions: number;
  usedSessions: number;
  remainingSessions: number;
  reservedSessions?: number; // remainingSessions 중 PT 회차 예약으로 잡힌 횟수(ADR-RSV-09)
  purchasedAt: string;
}
