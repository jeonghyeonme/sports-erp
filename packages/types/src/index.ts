// admin-web / member-app / api가 공유하는 DTO·타입을 여기에 둡니다.
// 예: export type Role = 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'MEMBER';

export type Role = 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'MEMBER';

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  meta?: { page: number; pageSize: number; total: number };
}
