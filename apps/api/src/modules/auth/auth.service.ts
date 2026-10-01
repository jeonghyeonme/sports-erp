import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { Account, Member, Staff } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { AppException } from '../../common/exceptions/app.exception';
import { AccessTokenPayload, RefreshTokenPayload } from './types/jwt-payload.interface';
import { secretFromEnv } from '../../common/config/secrets';

// 권한관리 A-3 RefreshToken — access token과 별도 시크릿/수명을 쓴다(하나가 새도 다른 하나까지 위조되지 않도록).
const REFRESH_TOKEN_SECRET = secretFromEnv('JWT_REFRESH_SECRET', 'change-me-refresh');
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '14d';

type AccountWithProfile = Account & { staff: Staff | null; member: Member | null };

@Injectable()
export class AuthService {
  constructor(
    // D26에서 시작한 "Prisma 먼저, 없으면 mock" 이중 경로는 D32(회원 계정 이관)로 끝났다 — 모든 계정이 DB에 있다.
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: RequestUser }> {
    // D27 — email은 활성 계정끼리만 unique(ADR-MEM-02 부분 인덱스)라 탈퇴 계정과 재가입 계정이 같은
    // 이메일로 공존할 수 있다. 활성 계정을 먼저 고르고, 비활성뿐이면 그걸 돌려 assertAccountActive가
    // ACCOUNT_INACTIVE로 거부하게 한다(비활성 계정을 건너뛰어 mock 폴백으로 새는 것을 막음).
    const account = await this.prisma.account.findFirst({
      where: { email },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      include: { staff: true, member: true },
    });
    if (!account) {
      throw new AppException('INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.', 401);
    }
    await this.assertPasswordMatches(password, account.passwordHash);
    this.assertAccountActive(account.isActive);
    return this.issuePrismaSession(account);
  }

  // ADR-MEM-01·02 — 회원 연동·가입 직후 바로 로그인시킬 때 로그인과 같은 발급 로직을 그대로 쓴다
  // (토큰 서명 방식이 로그인과 달라지면 안 되므로 별도 구현을 만들지 않음).
  async issueSessionFor(accountId: string): Promise<{ accessToken: string; refreshToken: string; user: RequestUser }> {
    const account = await this.prisma.account.findUniqueOrThrow({
      where: { id: accountId },
      include: { staff: true, member: true },
    });
    return this.issuePrismaSession(account);
  }

  // 권한관리 A-5 POST /auth/refresh, 권한관리 A-6 "1회용(rotate)" — 기존 refresh token은 검증과 동시에 폐기하고 둘 다 새로 발급한다.
  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = this.verifyRefreshToken(refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!stored || stored.revokedAt || stored.tokenHash !== this.hashToken(refreshToken)) {
      throw new AppException('INVALID_REFRESH_TOKEN', '유효하지 않은 갱신 토큰입니다.', 401);
    }
    if (stored.expiresAt.getTime() < Date.now()) {
      throw new AppException('INVALID_REFRESH_TOKEN', '만료된 갱신 토큰입니다.', 401);
    }
    const account = await this.prisma.account.findUnique({ where: { id: payload.sub } });
    if (!account || account.isActive === false) {
      throw new AppException('ACCOUNT_INACTIVE', '비활성화된 계정입니다. 관리자에게 문의하세요.', 401);
    }
    await this.prisma.refreshToken.update({ where: { id: payload.jti }, data: { revokedAt: new Date() } });
    return {
      accessToken: this.signAccessToken(account.id),
      refreshToken: await this.issuePrismaRefreshToken(account.id),
    };
  }

  // 권한관리 A-5 POST /auth/logout — Refresh Token revoke. 이미 만료된 토큰으로도 로그아웃은 되어야 하므로 만료는 무시한다.
  async logout(refreshToken: string): Promise<void> {
    const payload = this.verifyRefreshToken(refreshToken, { ignoreExpiration: true });
    await this.prisma.refreshToken.updateMany({
      where: { id: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // 권한관리 A-5 PATCH /auth/password.
  async changePassword(accountId: string, currentPassword: string, newPassword: string): Promise<void> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) {
      throw new AppException('ACCOUNT_NOT_FOUND', '계정을 찾을 수 없습니다.', 404);
    }
    await this.assertPasswordMatches(currentPassword, account.passwordHash);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.account.update({ where: { id: accountId }, data: { passwordHash } });
  }

  // 권한관리 A-6 — role/branchId를 매 요청 이 조회 결과로 새로 구성하는 단일 원천(JwtStrategy도 이걸 쓴다).
  // 실제 스키마엔 Account에 branchId가 없어 Staff/Member를 거쳐 조회한다.
  async buildRequestUser(account: AccountWithProfile): Promise<RequestUser> {
    const branchId = account.staff?.branchId ?? account.member?.branchId;
    const branch = branchId ? await this.prisma.branch.findUnique({ where: { id: branchId } }) : null;
    return {
      accountId: account.id,
      email: account.email,
      name: account.name,
      role: account.role,
      branchId: branchId ?? undefined,
      branchName: branch?.name,
      staffId: account.staff?.id,
      memberId: account.member?.id,
    };
  }

  private async issuePrismaSession(
    account: AccountWithProfile,
  ): Promise<{ accessToken: string; refreshToken: string; user: RequestUser }> {
    const user = await this.buildRequestUser(account);
    const accessToken = this.signAccessToken(account.id);
    const refreshToken = await this.issuePrismaRefreshToken(account.id);
    return { accessToken, refreshToken, user };
  }

  private async assertPasswordMatches(plain: string, hash: string): Promise<void> {
    const matches = await bcrypt.compare(plain, hash);
    if (!matches) {
      throw new AppException('INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.', 401);
    }
  }

  // 회원관리 A-6 — 회원 탈퇴(WITHDRAWN) 시 연결 계정이 isActive=false로 전환되며, 그 즉시 로그인이 막혀야 한다.
  private assertAccountActive(isActive: boolean | undefined): void {
    if (isActive === false) {
      throw new AppException('ACCOUNT_INACTIVE', '비활성화된 계정입니다. 관리자에게 문의하세요.', 401);
    }
  }

  // access token엔 sub만 담는다 — role/branchId는 매 요청 JwtStrategy가 최신 Account에서 새로 읽는다(권한관리 A-6, ADR-AUTH-01).
  private signAccessToken(accountId: string): string {
    const payload: AccessTokenPayload = { sub: accountId };
    return this.jwtService.sign(payload);
  }

  private async issuePrismaRefreshToken(accountId: string): Promise<string> {
    const jti = randomUUID();
    const payload: RefreshTokenPayload = { sub: accountId, jti };
    const token = this.jwtService.sign(payload, {
      secret: REFRESH_TOKEN_SECRET,
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });
    const decoded = this.jwtService.decode(token) as { exp: number };
    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        accountId,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(decoded.exp * 1000),
      },
    });
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

  // 원문 대신 해시로 저장(권한관리 A-3 RefreshToken.tokenHash) — DB/메모리가 유출돼도 토큰 자체는 못 꺼내 쓴다.
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
