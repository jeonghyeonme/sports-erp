import { Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { MemberService } from './member.service';
import { AuthModule } from '../auth/auth.module';

// ADR-MEM-01·02 — 연동·가입 직후 로그인 토큰을 발급하려고 AuthService를 가져다 쓴다.
// D32 — 회원 원천은 DB(MemberService).
@Module({ imports: [AuthModule], controllers: [MembersController], providers: [MemberService] })
export class MembersModule {}
