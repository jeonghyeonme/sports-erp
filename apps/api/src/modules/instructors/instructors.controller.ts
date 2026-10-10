import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { ScopedResource } from '../../common/decorators/scoped-resource.decorator';
import { InstructorService } from './instructor.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ok } from '../../common/http/api-response';
import { maskPhones } from '../../common/privacy/mask-phone';
import { CreateInstructorDto } from './dto/create-instructor.dto';
import { UpdateInstructorDto } from './dto/update-instructor.dto';

// 강사프로그램게시 A-7 — 회원 포함 모든 역할이 조회 가능, 등록/수정/비활성화는 BRANCH_ADMIN 본인 지점만.
// D46 — 지점 범위(branchId·:id 소유)는 전역 BranchScopeGuard가 본다.
@Controller('instructors')
export class InstructorsController {
  constructor(private readonly instructorService: InstructorService) {}

  @Get()
  async list(@Query('branchId') branchId?: string) {
    // ADR-MEM-04 — 회원도 보는 목록이라 강사 연락처를 마스킹한다.
    return ok(maskPhones(await this.instructorService.list(branchId)));
  }

  @Post()
  @Roles('BRANCH_ADMIN')
  async hire(@Body() dto: CreateInstructorDto, @CurrentUser() user: RequestUser) {
    if (!user.branchId) {
      throw new AppException('BRANCH_REQUIRED', '소속 지점이 없는 계정입니다.', 403);
    }
    return ok(await this.instructorService.hire(user.branchId, dto));
  }

  @Patch(':id')
  @Roles('BRANCH_ADMIN')
  @ScopedResource('instructor')
  async update(@Param('id') id: string, @Body() dto: UpdateInstructorDto) {
    return ok(await this.instructorService.update(id, dto));
  }

  // 강사프로그램게시 A-5 "수정/비활성화" — 물리 삭제 대신 isActive=false로 소프트 비활성화한다(강사프로그램게시 A-6 소프트 삭제 원칙).
  @Delete(':id')
  @Roles('BRANCH_ADMIN')
  @ScopedResource('instructor')
  async deactivate(@Param('id') id: string) {
    return ok(await this.instructorService.update(id, { isActive: false }));
  }
}
