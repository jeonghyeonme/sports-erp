import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
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
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { BranchScopeGuard } from './common/guards/branch-scope.guard';
import { ScopeOwners } from './common/guards/scope-owners';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // D26(2026-09-28) 인증부터 시작한 MockDataService→PrismaService 전환이 D36(게시판)으로 끝나
    // MockDataModule을 없앴다. 모든 도메인의 원천은 PrismaService다.
    PrismaModule,
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
    AuditLogsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // D46 — 지점 격리 검사를 한 곳으로(branchId 파라미터·쿼리 + @ScopedResource 리소스 소유). 등록 순서대로 실행된다.
    ScopeOwners,
    { provide: APP_GUARD, useClass: BranchScopeGuard },
  ],
})
export class AppModule {}
