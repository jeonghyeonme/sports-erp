import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { Account, Member, Staff } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MockDataService } from '../../mock-data/mock-data.service';
import { MockAccount } from '../../mock-data/mock-data.types';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { AppException } from '../../common/exceptions/app.exception';
import { AccessTokenPayload, RefreshTokenPayload } from './types/jwt-payload.interface';

// 01문서 §3 RefreshToken — access token과 별도 시크릿/수명을 쓴다(하나가 새도 다른 하나까지 위조되지 않도록).
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '14d';

type AccountWithProfile = Account & { staff: Staff | null; member: Member | null };

@Injectable()
export class AuthService {
  constructor(
    // D26(2026-09-28) 1단계 — MockDataService→PrismaService 전환, 인증부터 착수.
    //
    // 과도기 설계: login/refresh/logout/changePassword는 전부 "Prisma에서 먼저 찾고, 없으면
    // mock에서 찾는" 이중 경로다. 순수하게 Prisma만 보게 만들면 간단하겠지만, 그러면 아직
    // 이관 안 된 나머지 16개 도메인(회원가입·직원 채용·권한 전환 등, 전부 MockDataService 기반)의
    // 테스트와 실제 흐름이 전부 로그인 자체가 안 돼서 깨진다 — /auth/login은 모든 도메인이
    // 공유하는 단일 진입점이기 때문이다. 두 계정 저장소는 ID 체계가 겹치지 않아(Prisma는 UUID,
    // mock은 'account-xxx' 형태) 폴백이 안전하다. 도메인이 하나씩 이관될 때마다 그 도메인의
    // mock 폴백 경로를 지워나가고, 전부 끝나면 이 파일에서 mockData 의존성 자체를 없앤다.
    private readonly mockData: MockDataService,
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
    if (account) {
      await this.assertPasswordMatches(password, account.passwordHash);
      this.assertAccountActive(account.isActive);
      return this.issuePrismaSession(account);
    }

    // 과도기 폴백 — 아직 Prisma로 이관 안 된 도메인(예: 회원가입)에서 만든 mock 계정.
    const mockAccount = this.mockData.findAccountByEmail(email);
    if (!mockAccount) {
      throw new AppException('INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.', 401);
    }
    await this.assertPasswordMatches(password, mockAccount.passwordHash);
    this.assertAccountActive(mockAccount.isActive);
    return this.issueSession(mockAccount);
  }

  // ADR-MEM-01 — /members/link가 연동 직후 바로 로그인시킬 때도 이 발급 로직을 그대로 재사용한다
  // (토큰 서명 방식이 로그인과 달라지면 안 되므로 별도 구현을 만들지 않음). members 도메인이
  // 아직 mock이라, mock 계정 전용 경로는 그대로 남겨둔다(위 login()의 폴백과 동일한 이유).
  issueSession(account: MockAccount): { accessToken: string; refreshToken: string; user: RequestUser } {
    const user = this.mockData.toRequestUser(account);
    const accessToken = this.signAccessToken(account.id);
    const refreshToken = this.issueMockRefreshToken(account.id);
    return { accessToken, refreshToken, user };
  }

  // 01문서 §5 POST /auth/refresh, §6 "1회용(rotate)" — 기존 refresh token은 검증과 동시에 폐기하고 둘 다 새로 발급한다.
  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = this.verifyRefreshToken(refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (stored) {
      if (stored.revokedAt || stored.tokenHash !== this.hashToken(refreshToken)) {
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

    // 과도기 폴백 — mock 경로(issueSession)로 발급된 토큰.
    const mockStored = this.mockData.findRefreshToken(payload.jti);
    if (!mockStored || mockStored.revokedAt || mockStored.tokenHash !== this.hashToken(refreshToken)) {
      throw new AppException('INVALID_REFRESH_TOKEN', '유효하지 않은 갱신 토큰입니다.', 401);
    }
    if (new Date(mockStored.expiresAt).getTime() < Date.now()) {
      throw new AppException('INVALID_REFRESH_TOKEN', '만료된 갱신 토큰입니다.', 401);
    }
    const mockAccount = this.mockData.findAccountById(payload.sub);
    if (!mockAccount || mockAccount.isActive === false) {
      throw new AppException('ACCOUNT_INACTIVE', '비활성화된 계정입니다. 관리자에게 문의하세요.', 401);
    }
    this.mockData.revokeRefreshToken(payload.jti);
    return {
      accessToken: this.signAccessToken(mockAccount.id),
      refreshToken: this.issueMockRefreshToken(mockAccount.id),
    };
  }

  // 01문서 §5 POST /auth/logout — Refresh Token revoke. 이미 만료된 토큰으로도 로그아웃은 되어야 하므로 만료는 무시한다.
  // jti 공간이 Prisma/mock 양쪽 다 randomUUID()라 서로 겹치지 않으므로, 둘 다 시도해도 안전(idempotent)하다.
  async logout(refreshToken: string): Promise<void> {
    const payload = this.verifyRefreshToken(refreshToken, { ignoreExpiration: true });
    await this.prisma.refreshToken.updateMany({
      where: { id: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.mockData.revokeRefreshToken(payload.jti);
  }

  // 01문서 §5 PATCH /auth/password.
  async changePassword(accountId: string, currentPassword: string, newPassword: string): Promise<void> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (account) {
      await this.assertPasswordMatches(currentPassword, account.passwordHash);
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await this.prisma.account.update({ where: { id: accountId }, data: { passwordHash } });
      return;
    }

    // 과도기 폴백.
    const mockAccount = this.mockData.findAccountById(accountId);
    if (!mockAccount) {
      throw new AppException('ACCOUNT_NOT_FOUND', '계정을 찾을 수 없습니다.', 404);
    }
    await this.assertPasswordMatches(currentPassword, mockAccount.passwordHash);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    this.mockData.updateAccountPassword(accountId, passwordHash);
  }

  // 01문서 §6 — role/branchId를 매 요청 이 조회 결과로 새로 구성하는 단일 원천(JwtStrategy도 이걸 쓴다).
  // 실제 스키마엔 Account에 branchId가 없어 Staff/Member를 거쳐 조회한다 — mockData.toRequestUser()의
  // Prisma 버전.
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

  // 05문서 §6 — 회원 탈퇴(WITHDRAWN) 시 연결 계정이 isActive=false로 전환되며, 그 즉시 로그인이 막혀야 한다.
  private assertAccountActive(isActive: boolean | undefined): void {
    if (isActive === false) {
      throw new AppException('ACCOUNT_INACTIVE', '비활성화된 계정입니다. 관리자에게 문의하세요.', 401);
    }
  }

  // access token엔 sub만 담는다 — role/branchId는 매 요청 JwtStrategy가 최신 Account에서 새로 읽는다(§6).
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

  // mock 계정(issueSession) 전용 — members 도메인이 이관되기 전까지 MockDataService에 저장한다.
  private issueMockRefreshToken(accountId: string): string {
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
