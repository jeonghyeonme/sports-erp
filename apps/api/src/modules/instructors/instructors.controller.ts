import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { MockDataService } from '../../mock-data/mock-data.service';
import { AppException } from '../../common/exceptions/app.exception';
import { MockInstructor } from '../../mock-data/mock-data.types';
import { ok } from '../../common/http/api-response';
import { CreateInstructorDto } from './dto/create-instructor.dto';
import { UpdateInstructorDto } from './dto/update-instructor.dto';

// 07문서 §7 — 회원 포함 모든 역할이 조회 가능, 등록/수정/비활성화는 BRANCH_ADMIN 본인 지점만.
@Controller('instructors')
@UseGuards(BranchScopeGuard)
export class InstructorsController {
  constructor(private readonly mockData: MockDataService) {}

  @Get()
  list(@Query('branchId') branchId?: string) {
    const instructors = branchId
      ? this.mockData.instructors.filter((i) => i.branchId === branchId)
      : this.mockData.instructors;
    return ok(instructors.map((i) => this.toListItem(i)));
  }

  @Post()
  @Roles('BRANCH_ADMIN')
  hire(@Body() dto: CreateInstructorDto, @CurrentUser() user: RequestUser) {
    if (!user.branchId) {
      throw new AppException('BRANCH_REQUIRED', '소속 지점이 없는 계정입니다.', 403);
    }
    return ok(this.toListItem(this.mockData.hireInstructor(user.branchId, dto)));
  }

  @Patch(':id')
  @Roles('BRANCH_ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateInstructorDto, @CurrentUser() user: RequestUser) {
    this.assertOwnBranch(this.findInstructorOrThrow(id), user);
    return ok(this.toListItem(this.mockData.updateInstructor(id, dto)));
  }

  // 07문서 §5 "수정/비활성화" — 물리 삭제 대신 isActive=false로 소프트 비활성화한다(§6 소프트 삭제 원칙).
  @Delete(':id')
  @Roles('BRANCH_ADMIN')
  deactivate(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    this.assertOwnBranch(this.findInstructorOrThrow(id), user);
    return ok(this.toListItem(this.mockData.deactivateInstructor(id)));
  }

  private toListItem(instructor: MockInstructor) {
    return { ...instructor, branchName: this.mockData.findBranchById(instructor.branchId)?.name };
  }

  private findInstructorOrThrow(id: string): MockInstructor {
    const instructor = this.mockData.findInstructorById(id);
    if (!instructor) {
      throw new AppException('INSTRUCTOR_NOT_FOUND', '강사를 찾을 수 없습니다.', 404);
    }
    return instructor;
  }

  private assertOwnBranch(instructor: MockInstructor, user: RequestUser): void {
    if (instructor.branchId !== user.branchId) {
      throw new AppException('INSTRUCTOR_SCOPE_VIOLATION', '다른 지점의 강사는 수정할 수 없습니다.', 403);
    }
  }
}
