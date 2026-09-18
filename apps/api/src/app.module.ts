import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { MockDataModule } from './mock-data/mock-data.module';
import { AuthModule } from './modules/auth/auth.module';
import { BranchesModule } from './modules/branches/branches.module';
import { MembersModule } from './modules/members/members.module';
import { StaffModule } from './modules/staff/staff.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { PostsModule } from './modules/posts/posts.module';
import { FacilitiesModule } from './modules/facilities/facilities.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Phase 1 스캐폴딩 단계: PrismaModule 대신 MockDataModule을 사용합니다.
    // 로컬에 Docker/PostgreSQL이 없어도 `npm run dev`로 바로 구조를 확인할 수 있게 하기 위함이며,
    // 실제 DB 연동 시 PrismaModule을 다시 imports에 넣고 각 컨트롤러가 PrismaService를 쓰도록 바꿉니다.
    MockDataModule,
    AuthModule,
    BranchesModule,
    MembersModule,
    StaffModule,
    AttendanceModule,
    ProgramsModule,
    PostsModule,
    FacilitiesModule,
    PermissionsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
