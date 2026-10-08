import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { ok } from '../../common/http/api-response';
import { AuditLogService } from './audit-log.service';

const MAX_PAGE_SIZE = 100;

// D44 — 변경 이력은 본사 감사 기록이라 SUPER_ADMIN만 본다(지점 단위 데이터가 아니므로 BranchScopeGuard 대상 아님).
// 페이지 형식은 D43·ADR-BRD-02와 같다(page·limit, meta.total/page/pageSize). 상한 100.
@Controller('audit-logs')
@Roles('SUPER_ADMIN')
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogService) {}

  @Get()
  async list(
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('page') pageQuery?: string,
    @Query('limit') limitQuery?: string,
  ) {
    const page = Math.max(1, Math.trunc(Number(pageQuery)) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(limitQuery)) || 20));
    const { items, total } = await this.auditLogs.list({ entity, entityId, action, page, pageSize });
    return ok(items, { page, pageSize, total });
  }
}
