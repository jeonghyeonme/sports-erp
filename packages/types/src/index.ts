// admin-web / member-app / api가 공유하는 DTO·타입을 여기에 둡니다.

export type Role = 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'STAFF' | 'MEMBER';

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: { page: number; pageSize: number; total: number };
}

/** GET /auth/me 및 로그인 응답에 포함되는 인증 주체 요약 정보 */
export interface AuthUser {
  accountId: string;
  email: string;
  role: Role;
  branchId: string | null;
  staffId: string | null;
  memberId: string | null;
  name: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}
