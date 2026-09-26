import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET ?? 'change-me',
      signOptions: { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '30m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // ADR-MEM-01 — /members/link가 연동 직후 바로 로그인시키려고 AuthService.issueSession()을 재사용한다.
  exports: [AuthService],
})
export class AuthModule {}
