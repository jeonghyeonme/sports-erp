// admin-web과 같은 이유로 packages/types 대신 로컬에 둔다(admin-web/src/lib/types.ts 상단 주석 — Vite 워크스페이스
// 심볼릭 링크 해석 이슈). 형태는 api의 RequestUser·공통 응답 envelope(system-overview §4)과 맞춘다.

export type Role = 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'STAFF' | 'MEMBER';

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

export type PricingType = 'FREE_ACCESS' | 'PAID_SESSION' | 'PT_PACKAGE';

export interface Program {
  id: string;
  branchId: string;
  name: string;
  category: string;
  description?: string;
  pricingType: PricingType;
  price: number;
  capacity?: number;
  status: string;
  instructorName?: string;
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

export type ReservationStatus = 'REQUESTED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
export type PaymentStatus = 'PENDING' | 'APPROVED' | 'FAILED' | 'REFUNDED';

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
}
