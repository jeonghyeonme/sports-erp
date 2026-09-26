import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { MockDataService } from '../../mock-data/mock-data.service';
import { MockAccount } from '../../mock-data/mock-data.types';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { AppException } from '../../common/exceptions/app.exception';
import { AccessTokenPayload, RefreshTokenPayload } from './types/jwt-payload.interface';

// 01문서 §3 RefreshToken — access token과 별도 시크릿/수명을 쓴다(하나가 새도 다른 하나까지 위조되지 않도록).
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '14d';

@Injectable()
export class AuthService {
  constructor(
    private readonly mockData: MockDataService,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: RequestUser }> {
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

    return this.issueSession(account);
  }

  // ADR-MEM-01 — /members/link가 연동 직후 바로 로그인시킬 때도 이 발급 로직을 그대로 재사용한다
  // (토큰 서명 방식이 로그인과 달라지면 안 되므로 별도 구현을 만들지 않음).
  issueSession(account: MockAccount): { accessToken: string; refreshToken: string; user: RequestUser } {
    const user = this.mockData.toRequestUser(account);
    const accessToken = this.signAccessToken(account.id);
    const refreshToken = this.issueRefreshToken(account.id);
    return { accessToken, refreshToken, user };
  }

  // 01문서 §5 POST /auth/refresh, §6 "1회용(rotate)" — 기존 refresh token은 검증과 동시에 폐기하고 둘 다 새로 발급한다.
  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = this.verifyRefreshToken(refreshToken);
    const stored = this.mockData.findRefreshToken(payload.jti);
    if (!stored || stored.revokedAt || stored.tokenHash !== this.hashToken(refreshToken)) {
      throw new AppException('INVALID_REFRESH_TOKEN', '유효하지 않은 갱신 토큰입니다.', 401);
    }
    if (new Date(stored.expiresAt).getTime() < Date.now()) {
      throw new AppException('INVALID_REFRESH_TOKEN', '만료된 갱신 토큰입니다.', 401);
    }

    const account = this.mockData.findAccountById(payload.sub);
    if (!account || account.isActive === false) {
      throw new AppException('ACCOUNT_INACTIVE', '비활성화된 계정입니다. 관리자에게 문의하세요.', 401);
    }

    this.mockData.revokeRefreshToken(payload.jti);
    return {
      accessToken: this.signAccessToken(account.id),
      refreshToken: this.issueRefreshToken(account.id),
    };
  }

  // 01문서 §5 POST /auth/logout — Refresh Token revoke. 이미 만료된 토큰으로도 로그아웃은 되어야 하므로 만료는 무시한다.
  logout(refreshToken: string): void {
    const payload = this.verifyRefreshToken(refreshToken, { ignoreExpiration: true });
    this.mockData.revokeRefreshToken(payload.jti);
  }

  // 01문서 §5 PATCH /auth/password.
  async changePassword(accountId: string, currentPassword: string, newPassword: string): Promise<void> {
    const account = this.mockData.findAccountById(accountId);
    if (!account) {
      throw new AppException('ACCOUNT_NOT_FOUND', '계정을 찾을 수 없습니다.', 404);
    }
    const matches = await bcrypt.compare(currentPassword, account.passwordHash);
    if (!matches) {
      throw new AppException('INVALID_CREDENTIALS', '현재 비밀번호가 올바르지 않습니다.', 401);
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    this.mockData.updateAccountPassword(accountId, passwordHash);
  }

  // access token엔 sub만 담는다 — role/branchId는 매 요청 JwtStrategy가 최신 Account에서 새로 읽는다(§6).
  private signAccessToken(accountId: string): string {
    const payload: AccessTokenPayload = { sub: accountId };
    return this.jwtService.sign(payload);
  }

  private issueRefreshToken(accountId: string): string {
    const jti = randomUUID();
    const payload: RefreshTokenPayload = { sub: accountId, jti };
    const token = this.jwtService.sign(payload, {
      secret: REFRESH_TOKEN_SECRET,
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });
    const decoded = this.jwtService.decode(token) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000).toISOString();
    this.mockData.storeRefreshToken(jti, accountId, this.hashToken(token), expiresAt);
    return token;
  }

  private verifyRefreshToken(
    token: string,
    options?: { ignoreExpiration?: boolean },
  ): RefreshTokenPayload {
    try {
      return this.jwtService.verify<RefreshTokenPayload>(token, {
        secret: REFRESH_TOKEN_SECRET,
        ignoreExpiration: options?.ignoreExpiration,
      });
    } catch {
      throw new AppException('INVALID_REFRESH_TOKEN', '유효하지 않은 갱신 토큰입니다.', 401);
    }
  }

  // 원문 대신 해시로 저장(01문서 §3 RefreshToken.tokenHash) — DB/메모리가 유출돼도 토큰 자체는 못 꺼내 쓴다.
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
