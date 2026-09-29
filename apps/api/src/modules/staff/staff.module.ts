import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { InstructorsModule } from '../instructors/instructors.module';

// D30 — 권한 전환(PermissionsModule)도 같은 서비스를 쓴다.
// D31 — 파견이 강사 연결을 풀면 강사 미러를 맞춰야 해서 InstructorsModule을 가져온다.
@Module({
  imports: [InstructorsModule],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
