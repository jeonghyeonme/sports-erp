import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MockDataService } from '../../mock-data/mock-data.service';
import { MockAccount } from '../../mock-data/mock-data.types';
import { RequestUser } from '../../common/interfaces/request-user.interface';

const INVALID_CREDENTIALS = {
  code: 'INVALID_CREDENTIALS',
  message: '이메일 또는 비밀번호가 올바르지 않습니다.',
};

@Injectable()
export class AuthService {
  constructor(
    private readonly mockData: MockDataService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string; user: RequestUser }> {
    const account = this.mockData.findAccountByEmail(email);
    if (!account) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const passwordMatches = await bcrypt.compare(password, account.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
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
