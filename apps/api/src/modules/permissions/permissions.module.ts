import { Module } from '@nestjs/common';
import { PermissionsController } from './permissions.controller';
import { PermissionAdminService } from './permission-admin.service';
import { StaffModule } from '../staff/staff.module';

@Module({ imports: [StaffModule], controllers: [PermissionsController], providers: [PermissionAdminService] })
export class PermissionsModule {}
