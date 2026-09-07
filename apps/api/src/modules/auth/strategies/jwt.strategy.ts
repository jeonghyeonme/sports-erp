import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RequestUser } from '../../../common/interfaces/request-user.interface';

type JwtPayload = RequestUser & { sub: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET ?? 'change-me',
    });
  }

  validate(payload: JwtPayload): RequestUser {
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
