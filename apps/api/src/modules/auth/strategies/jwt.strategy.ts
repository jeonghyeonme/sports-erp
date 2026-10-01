import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RequestUser } from '../../../common/interfaces/request-user.interface';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthService } from '../auth.service';
import { AppException } from '../../../common/exceptions/app.exception';
import { AccessTokenPayload } from '../types/jwt-payload.interface';
import { secretFromEnv } from '../../../common/config/secrets';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secretFromEnv('JWT_ACCESS_SECRET', 'change-me'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<RequestUser> {
    // 권한관리 A-6 — 매 요청마다 Account를 다시 조회해 isActive를 확인하는 것은 물론,
    // role/branchId도 이 조회 결과로 새로 구성해야 한다. 로그인 시점 JWT에 role/branchId를
    // 그대로 실어 보냈다가 여기서 그 값을 그대로 돌려주면, 파견발령·Role전환·퇴사 처리가
    // "재로그인 없이 다음 요청부터 즉시 반영"된다는 §6의 원칙이 깨진다(access token엔 sub만 담는다).
    const account = await this.prisma.account.findUnique({
      where: { id: payload.sub },
      include: { staff: true, member: true },
    });
    // D32 — 모든 계정이 DB에 있다(mock 폴백 종료).
    if (!account || account.isActive === false) {
      throw new AppException('ACCOUNT_INACTIVE', '비활성화된 계정입니다. 관리자에게 문의하세요.', 401);
    }
    return this.authService.buildRequestUser(account);
  }
}
