import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MockDataService } from '../../mock-data/mock-data.service';
import { MockAccount } from '../../mock-data/mock-data.types';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { AppException } from '../../common/exceptions/app.exception';

@Injectable()
export class AuthService {
  constructor(
    private readonly mockData: MockDataService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string; user: RequestUser }> {
    const account = this.mockData.findAccountByEmail(email);
    if (!account) {
      throw new AppException('INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.', 401);
    }

    const passwordMatches = await bcrypt.compare(password, account.passwordHash);
    if (!passwordMatches) {
      throw new AppException('INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.', 401);
    }

    // 05문서 §6 — 회원 탈퇴(WITHDRAWN) 시 연결 계정이 isActive=false로 전환되며, 그 즉시 로그인이 막혀야 한다.
    if (account.isActive === false) {
      throw new AppException('ACCOUNT_INACTIVE', '비활성화된 계정입니다. 관리자에게 문의하세요.', 401);
    }

    const user = this.toRequestUser(account);
    const accessToken = this.jwtService.sign({ ...user, sub: account.id });
    return { accessToken, user };
  }

  private toRequestUser(account: MockAccount): RequestUser {
    const branch = account.branchId ? this.mockData.findBranchById(account.branchId) : undefined;
    return {
      accountId: account.id,
      email: account.email,
      name: account.name,
      role: account.role,
      branchId: account.branchId,
      branchName: branch?.name,
      staffId: account.staffId,
      memberId: account.memberId,
    };
  }
}
