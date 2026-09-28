import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { MockDataModule } from './mock-data/mock-data.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { BranchesModule } from './modules/branches/branches.module';
import { MembersModule } from './modules/members/members.module';
import { StaffModule } from './modules/staff/staff.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { InstructorsModule } from './modules/instructors/instructors.module';
import { PostsModule } from './modules/posts/posts.module';
import { FacilitiesModule } from './modules/facilities/facilities.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AssetsModule } from './modules/assets/assets.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // D26(2026-09-28) 1단계 — MockDataService→PrismaService 전환 착수. 인증 모듈부터
    // PrismaService로 이관했고(가장 트래픽이 높고 위험도 큰 경로라 첫 검증 대상으로 택함),
    // 나머지 16개 도메인은 아직 MockDataModule을 쓴다 — 둘 다 @Global()이라 공존 가능.
    // 도메인별 이관이 끝나는 대로 MockDataModule을 하나씩 걷어낼 것.
    PrismaModule,
    MockDataModule,
    AuthModule,
    BranchesModule,
    MembersModule,
    StaffModule,
    AttendanceModule,
    ProgramsModule,
    InstructorsModule,
    PostsModule,
    FacilitiesModule,
    PermissionsModule,
    ReservationsModule,
    PaymentsModule,
    AssetsModule,
    DocumentsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
