import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { MemberService } from './member.service';
import { RegisterMemberDto } from './dto/register-member.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateMemberStatusDto } from './dto/update-member-status.dto';
import { UsePtSessionDto } from './dto/use-pt-session.dto';
import { ListMembersQueryDto } from './dto/list-members-query.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/request-user.interface';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';

@Controller('members')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterMemberDto) {
    return this.memberService.register(dto);
  }

  @Roles('BRANCH_ADMIN')
  @UseGuards(BranchScopeGuard)
  @Post()
  createOffline(@Body() dto: CreateMemberDto, @CurrentUser() user: RequestUser) {
    return this.memberService.createOffline(dto, user);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  @UseGuards(BranchScopeGuard)
  @Get()
  list(@Query() query: ListMembersQueryDto, @CurrentUser() user: RequestUser) {
    return this.memberService.list(query, user);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'MEMBER')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.memberService.findOne(id, user);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'MEMBER')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMemberDto, @CurrentUser() user: RequestUser) {
    return this.memberService.update(id, dto, user);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMemberStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.memberService.updateStatus(id, dto.status, user);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'MEMBER')
  @Get(':id/enrollments')
  enrollments(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.memberService.enrollments(id, user);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'MEMBER')
  @Get(':id/pt-sessions')
  ptSessions(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.memberService.ptSessions(id, user);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  @Post(':id/pt-sessions/:sessionId/use')
  usePtSession(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: UsePtSessionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.memberService.usePtSession(id, sessionId, dto.note, user);
  }
}
