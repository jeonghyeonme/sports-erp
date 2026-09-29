import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

// D33 — 근태·휴가·업무일지 원천은 DB(AttendanceService).
@Module({ controllers: [AttendanceController], providers: [AttendanceService] })
export class AttendanceModule {}
