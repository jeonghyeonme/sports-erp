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
