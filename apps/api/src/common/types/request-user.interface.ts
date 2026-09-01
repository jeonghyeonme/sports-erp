import { Role } from '@prisma/client';

/** JwtStrategy.validate()가 채워 req.user에 주입하는 인증 컨텍스트 (00문서 §3.3) */
export interface RequestUser {
  accountId: string;
  email: string;
  role: Role;
  branchId: string | null;
  staffId: string | null;
  memberId: string | null;
}
