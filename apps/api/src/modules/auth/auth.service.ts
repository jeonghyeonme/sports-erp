import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { RequestUser } from '../../common/types/request-user.interface';
import { RefreshTokenPayload } from './types/jwt-payload.interface';

const MAX_FAILED_LOGIN = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const account = await this.prisma.account.findUnique({
      where: { email: dto.email },
      include: { staff: true, member: true },
    });

    if (!account) {
      throw new AppException(
        'INVALID_CREDENTIALS',
        '이메일 또는 비밀번호가 올바르지 않습니다.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (account.lockedUntil && account.lockedUntil > new Date()) {
      throw new AppException(
        'ACCOUNT_LOCKED',
        `로그인 5회 실패로 계정이 잠겼습니다. ${account.lockedUntil.toISOString()} 이후 다시 시도해주세요.`,
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!account.isActive) {
      throw new AppException('ACCOUNT_DEACTIVATED', '비활성화된 계정입니다.', HttpStatus.UNAUTHORIZED);
    }

    const passwordOk = await bcrypt.compare(dto.password, account.passwordHash);
    if (!passwordOk) {
      await this.registerFailedLogin(account.id, account.failedLoginCount);
      throw new AppException(
        'INVALID_CREDENTIALS',
        '이메일 또는 비밀번호가 올바르지 않습니다.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.prisma.account.update({
      where: { id: account.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokenPair(account.id);
    return {
      ...tokens,
      user: {
        accountId: account.id,
        email: account.email,
        role: account.role,
        branchId: account.staff?.branchId ?? account.member?.branchId ?? null,
        staffId: account.staff?.id ?? null,
        memberId: account.member?.id ?? null,
        name: account.staff?.name ?? account.member?.name ?? null,
      },
    };
  }

  /** 01문서 §6: 5회 연속 실패 시 15분 잠금 */
  private async registerFailedLogin(accountId: string, currentCount: number) {
    const nextCount = currentCount + 1;
    const data: { failedLoginCount: number; lockedUntil?: Date } = { failedLoginCount: nextCount };
    if (nextCount >= MAX_FAILED_LOGIN) {
      data.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
    }
    await this.prisma.account.update({ where: { id: accountId }, data });
  }

  private async issueTokenPair(accountId: string) {
    const accessToken = await this.jwt.signAsync({ sub: accountId });

    const jti = randomUUID();
    const refreshPayload: RefreshTokenPayload = { sub: accountId, jti };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
    });

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        accountId,
        tokenHash: await bcrypt.hash(refreshToken, 10),
        expiresAt: this.refreshExpiryDate(),
      },
    });

    return { accessToken, refreshToken };
  }

  private refreshExpiryDate(): Date {
    const raw = this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN');
    const match = /^(\d+)([smhd])$/.exec(raw.trim());
    const amount = match ? Number(match[1]) : 14;
    const unit = match ? match[2] : 'd';
    const unitMs: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return new Date(Date.now() + amount * (unitMs[unit] ?? unitMs.d));
  }

  async refresh(refreshToken: string) {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new AppException('INVALID_REFRESH_TOKEN', '유효하지 않은 리프레시 토큰입니다.', HttpStatus.UNAUTHORIZED);
    }

    const row = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!row || row.accountId !== payload.sub || row.revokedAt) {
      throw new AppException('INVALID_REFRESH_TOKEN', '유효하지 않은 리프레시 토큰입니다.', HttpStatus.UNAUTHORIZED);
    }
    if (row.expiresAt < new Date()) {
      throw new AppException(
        'REFRESH_TOKEN_EXPIRED',
        '리프레시 토큰이 만료되었습니다. 다시 로그인해주세요.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const hashOk = await bcrypt.compare(refreshToken, row.tokenHash);
    if (!hashOk) {
      throw new AppException('INVALID_REFRESH_TOKEN', '유효하지 않은 리프레시 토큰입니다.', HttpStatus.UNAUTHORIZED);
    }

    const account = await this.prisma.account.findUnique({ where: { id: payload.sub } });
    if (!account || !account.isActive) {
      throw new AppException('ACCOUNT_DEACTIVATED', '비활성화된 계정입니다.', HttpStatus.UNAUTHORIZED);
    }

    // Phase 1 범위: access token만 재발급(리프레시 토큰은 만료까지 그대로 유지).
    // Refresh Token rotate는 01문서 §8 Phase 2(선택) 항목.
    const accessToken = await this.jwt.signAsync({ sub: account.id });
    return { accessToken };
  }

  async logout(refreshToken: string, user: RequestUser) {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        ignoreExpiration: true,
      });
    } catch {
      return { loggedOut: true }; // 이미 무효한 토큰 — 멱등하게 성공 처리
    }

    if (payload.sub !== user.accountId) {
      throw new AppException('FORBIDDEN', '본인의 세션만 로그아웃할 수 있습니다.', HttpStatus.FORBIDDEN);
    }

    await this.prisma.refreshToken.updateMany({
      where: { id: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { loggedOut: true };
  }

  async me(user: RequestUser) {
    const account = await this.prisma.account.findUniqueOrThrow({
      where: { id: user.accountId },
      include: { staff: true, member: true },
    });
    return {
      accountId: account.id,
      email: account.email,
      role: account.role,
      branchId: user.branchId,
      staffId: user.staffId,
      memberId: user.memberId,
      name: account.staff?.name ?? account.member?.name ?? null,
      lastLoginAt: account.lastLoginAt,
    };
  }

  async changePassword(user: RequestUser, dto: ChangePasswordDto) {
    const account = await this.prisma.account.findUniqueOrThrow({ where: { id: user.accountId } });
    const ok = await bcrypt.compare(dto.currentPassword, account.passwordHash);
    if (!ok) {
      throw new AppException('INVALID_CURRENT_PASSWORD', '현재 비밀번호가 올바르지 않습니다.', HttpStatus.BAD_REQUEST);
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.account.update({ where: { id: account.id }, data: { passwordHash } });
    return { changed: true };
  }
}
