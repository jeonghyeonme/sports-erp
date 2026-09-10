import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RequestUser } from '../../../common/interfaces/request-user.interface';
import { MockDataService } from '../../../mock-data/mock-data.service';
import { AppException } from '../../../common/exceptions/app.exception';

type JwtPayload = RequestUser & { sub: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly mockData: MockDataService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET ?? 'change-me',
    });
  }

  validate(payload: JwtPayload): RequestUser {
    // 01문서 §3.2 "매 요청의 인증 미들웨어에서 즉시 차단" — 토큰이 아직 유효해도
    // 그 사이 계정이 비활성화(회원 탈퇴 등)됐으면 여기서 걸러낸다.
    const account = this.mockData.findAccountById(payload.sub);
    if (!account || account.isActive === false) {
      throw new AppException('ACCOUNT_INACTIVE', '비활성화된 계정입니다. 관리자에게 문의하세요.', 401);
    }

    return {
      accountId: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      branchId: payload.branchId,
      branchName: payload.branchName,
      staffId: payload.staffId,
      memberId: payload.memberId,
    };
  }
}
