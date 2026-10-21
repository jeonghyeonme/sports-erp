import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { ok } from '../../common/http/api-response';
import { EXEMPT, PermissionExempt } from '../../common/permissions/permission.decorator';
import { InboxService } from './inbox.service';

// D61 — 처리 대기함(대시보드 첫 카드). 범위는 요청자 본인·본인 지점으로 고정이라 파라미터가 없다.
@Controller('inbox')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'STAFF')
  @PermissionExempt(EXEMPT.common)
  async list(@CurrentUser() user: RequestUser) {
    return ok(await this.inbox.forUser(user));
  }
}
