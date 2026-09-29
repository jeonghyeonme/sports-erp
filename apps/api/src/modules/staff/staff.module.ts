import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

// D30 — 권한 전환(PermissionsModule)도 같은 서비스를 쓴다.
@Module({ controllers: [StaffController], providers: [StaffService], exports: [StaffService] })
export class StaffModule {}
