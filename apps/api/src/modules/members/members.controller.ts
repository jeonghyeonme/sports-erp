import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { MockDataService } from '../../mock-data/mock-data.service';
import { AppException } from '../../common/exceptions/app.exception';
import { MockMember } from '../../mock-data/mock-data.types';
import { ok } from '../../common/http/api-response';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateMemberStatusDto } from './dto/update-member-status.dto';

// 05문서 §7 — STAFF는 회원 관리 API 접근 불가(403). MEMBER는 본인 레코드만 GET/PATCH 가능.
@Controller('members')
@UseGuards(BranchScopeGuard)
export class MembersController {
  constructor(private readonly mockData: MockDataService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN')
  list(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    let members = branchId
      ? this.mockData.members.filter((m) => m.branchId === branchId)
      : this.mockData.members;
    if (status) members = members.filter((m) => m.status === status);
    if (q) {
      const needle = q.trim().toLowerCase();
      members = members.filter(
        (m) =>
          m.name.toLowerCase().includes(needle) ||
          m.memberNo.toLowerCase().includes(needle) ||
          (m.phone ?? '').includes(needle),
      );
    }
    return ok(members.map((m) => this.toListItem(m)));
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'MEMBER')
  detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const member = this.findMemberOrThrow(id);
    this.assertReadable(member, user);
    // 수강내역/예약·결제내역/PT잔여세션 요약은 해당 mock 엔티티가 아직 없어 후속 작업으로 남겨둔다(05문서 §3 참고).
    return ok(this.toListItem(member));
  }

  @Post()
  @Roles('BRANCH_ADMIN')
  create(@Body() dto: CreateMemberDto, @CurrentUser() user: RequestUser) {
    if (!user.branchId) {
      throw new AppException('BRANCH_REQUIRED', '소속 지점이 없는 계정입니다.', 403);
    }
    const { member, warnings } = this.mockData.createMember(user.branchId, dto);
    return ok(this.toListItem(member), warnings.length ? { warnings } : undefined);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'BRANCH_ADMIN', 'MEMBER')
  update(@Param('id') id: string, @Body() dto: UpdateMemberDto, @CurrentUser() user: RequestUser) {
    const member = this.findMemberOrThrow(id);
    this.assertWritable(member, user);

    if (user.role === 'MEMBER' && (dto.assignedStaffId !== undefined || dto.memo !== undefined)) {
      throw new AppException(
        'MEMBER_FIELD_FORBIDDEN',
        '담당 직원/메모는 지점 관리자만 수정할 수 있습니다.',
        403,
      );
    }

    const updated = this.mockData.updateMember(id, dto);
    return ok(this.toListItem(updated));
  }

  @Patch(':id/status')
  @Roles('BRANCH_ADMIN')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateMemberStatusDto, @CurrentUser() user: RequestUser) {
    const member = this.findMemberOrThrow(id);
    this.assertWritable(member, user);
    const updated = this.mockData.updateMemberStatus(id, dto.status);
    return ok(this.toListItem(updated));
  }

  private findMemberOrThrow(id: string): MockMember {
    const member = this.mockData.findMemberById(id);
    if (!member) {
      throw new AppException('MEMBER_NOT_FOUND', '회원을 찾을 수 없습니다.', 404);
    }
    return member;
  }

  // 05문서 §7: BRANCH_ADMIN(본인 지점)/SUPER_ADMIN(전체)/MEMBER(본인)만 조회 가능.
  private assertReadable(member: MockMember, user: RequestUser): void {
    if (user.role === 'SUPER_ADMIN') return;
    if (user.role === 'MEMBER') {
      if (user.memberId === member.id) return;
    } else if (user.branchId === member.branchId) {
      return;
    }
    throw new AppException('MEMBER_SCOPE_VIOLATION', '이 회원 정보에 접근할 권한이 없습니다.', 403);
  }

  // 쓰기 권한은 조회보다 좁다 — SUPER_ADMIN은 기술적으로 허용(05문서 §7 "예외 상황 대응"),
  // BRANCH_ADMIN은 본인 지점만, MEMBER는 본인 레코드만.
  private assertWritable(member: MockMember, user: RequestUser): void {
    this.assertReadable(member, user);
  }

  private toListItem(member: MockMember) {
    return {
      ...member,
      branchName: this.mockData.findBranchById(member.branchId)?.name,
      assignedStaffName: member.assignedStaffId
        ? this.mockData.staff.find((s) => s.id === member.assignedStaffId)?.name
        : undefined,
    };
  }
}
