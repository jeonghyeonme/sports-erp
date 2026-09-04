// admin-web / member-app / api가 공유하는 DTO·타입을 여기에 둡니다.

export type Role = 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'STAFF' | 'MEMBER';

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: { page: number; pageSize: number; total: number };
}

export interface AuthUser {
  accountId: string;
  email: string;
  role: Role;
  name: string;
  branchId?: string;
  branchName?: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export type ProgramStatus = 'PREPARING' | 'RUNNING' | 'PAUSED' | 'ENDED';
export type PricingType = 'FREE_ACCESS' | 'PAID_SESSION' | 'PT_PACKAGE';

export interface BranchSummary {
  id: string;
  name: string;
  address?: string;
  memberCount: number;
  staffCount: number;
  runningProgramCount: number;
}
