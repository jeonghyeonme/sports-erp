import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user.interface';

@Controller('accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Roles('SUPER_ADMIN')
  @Post()
  create(@Body() dto: CreateAccountDto) {
    return this.accountService.create(dto);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.accountService.deactivate(id, user);
  }

  @Roles('SUPER_ADMIN')
  @Get()
  list(@Query() query: ListAccountsQueryDto) {
    return this.accountService.list(query.page, query.pageSize);
  }
}
