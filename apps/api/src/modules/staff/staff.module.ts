import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffChangeRequestsController } from './staff-change-requests.controller';
import { StaffChangeRequestService } from './staff-change-request.service';

// D30 — 권한 전환(PermissionsModule)도 같은 서비스를 쓴다. ADR-STF-09 — 인사 변경 신청.
@Module({
  controllers: [StaffController, StaffChangeRequestsController],
  providers: [StaffService, StaffChangeRequestService],
  exports: [StaffService],
})
export class StaffModule {}
