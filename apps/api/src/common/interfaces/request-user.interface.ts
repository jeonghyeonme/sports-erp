import { Role } from '../../fixtures/mock-data.types';

// JwtStrategy.validate()가 반환하고, 이후 모든 요청의 req.user에 실리는 형태.
// architecture/system-overview.md §3.3의 "JwtAuthGuard가 req.user(accountId, role, branchId)를 주입한다"를 그대로 구현.
export interface RequestUser {
  accountId: string;
  email: string;
  name: string;
  role: Role;
  branchId?: string;
  branchName?: string;
  staffId?: string;
  memberId?: string;
  // D60 — 개인 예외 권한(`feature:ACTION` → 허용 여부). 매 요청 계정과 함께 읽는다(ADR-AUTH-01).
  permissions?: Record<string, boolean>;
}
