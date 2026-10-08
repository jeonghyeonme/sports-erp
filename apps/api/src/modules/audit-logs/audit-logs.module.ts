import { Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogService } from './audit-log.service';

@Module({
  controllers: [AuditLogsController],
  providers: [AuditLogService],
})
export class AuditLogsModule {}
