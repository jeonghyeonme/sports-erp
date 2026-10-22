import { Module } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { secretFromEnv } from '../../common/config/secrets';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: secretFromEnv('JWT_ACCESS_SECRET', 'change-me'),
      // @nestjs/jwt 11 — expiresIn이 기간 문자열 형식(예: '30m')으로 좁혀졌다. 환경변수 값은 그 형식이라고 보고 넘긴다(log/166).
      signOptions: { expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '30m') as JwtSignOptions['expiresIn'] },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // ADR-MEM-01 — /members/link가 연동 직후 바로 로그인시키려고 AuthService.issueSession()을 재사용한다.
  exports: [AuthService],
})
export class AuthModule {}
