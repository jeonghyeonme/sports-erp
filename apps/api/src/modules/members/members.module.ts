import { Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { AuthModule } from '../auth/auth.module';

// ADR-MEM-01 — POST /members/link가 연동 직후 로그인 토큰을 발급하려고 AuthService를 가져다 쓴다.
@Module({ imports: [AuthModule], controllers: [MembersController] })
export class MembersModule {}
