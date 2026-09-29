import { Module } from '@nestjs/common';
import { PermissionsController } from './permissions.controller';
import { StaffModule } from '../staff/staff.module';

@Module({ imports: [StaffModule], controllers: [PermissionsController] })
export class PermissionsModule {}
