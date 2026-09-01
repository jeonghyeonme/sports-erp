import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccessTokenPayload } from '../types/jwt-payload.interface';
import { RequestUser } from '../../../common/types/request-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * 매 요청마다 Account를 다시 조회합니다(토큰 서명 검증만으로는 퇴사/탈퇴 즉시 차단을
   * 보장할 수 없기 때문 — 01문서 §3.2 "isActive=false 계정은 ... 매 요청의 인증 미들웨어에서
   * 즉시 차단" 요건). PK 단건 조회라 비용은 크지 않습니다.
   */
  async validate(payload: AccessTokenPayload): Promise<RequestUser> {
    const account = await this.prisma.account.findUnique({
      where: { id: payload.sub },
      include: { staff: true, member: true },
    });

    if (!account || !account.isActive) {
      throw new UnauthorizedException('ACCOUNT_DEACTIVATED');
    }

    return {
      accountId: account.id,
      email: account.email,
      role: account.role,
      branchId: account.staff?.branchId ?? account.member?.branchId ?? null,
      staffId: account.staff?.id ?? null,
      memberId: account.member?.id ?? null,
    };
  }
}
