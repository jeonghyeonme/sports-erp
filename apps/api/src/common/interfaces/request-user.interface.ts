import { Role } from '../../mock-data/mock-data.types';

// JwtStrategy.validate()가 반환하고, 이후 모든 요청의 req.user에 실리는 형태.
// 00문서 §3.3의 "JwtAuthGuard가 req.user(accountId, role, branchId)를 주입한다"를 그대로 구현.
export interface RequestUser {
  accountId: string;
  email: string;
  name: string;
  role: Role;
  branchId?: string;
  branchName?: string;
  staffId?: string;
  memberId?: string;
}
