import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { BranchScopeGuard } from '../../common/guards/branch-scope.guard';
import { MockDataService } from '../../mock-data/mock-data.service';
import { AppException } from '../../common/exceptions/app.exception';
import { MockProgram } from '../../mock-data/mock-data.types';
import { ok } from '../../common/http/api-response';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { UpdateProgramStatusDto } from './dto/update-program-status.dto';
import { CreateScheduleSlotDto } from './dto/create-schedule-slot.dto';

// 07문서 §7 — 회원 포함 모든 역할이 조회 가능(본인 소속 지점 기준 필터 기본 적용)
@Controller('programs')
@UseGuards(BranchScopeGuard)
export class ProgramsController {
  constructor(private readonly mockData: MockDataService) {}

  @Get()
  list(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('pricingType') pricingType?: string,
  ) {
    let programs = this.mockData.programs;
    if (branchId) programs = programs.filter((p) => p.branchId === branchId);
    if (status) programs = programs.filter((p) => p.status === status);
    if (pricingType) programs = programs.filter((p) => p.pricingType === pricingType);
    return ok(programs.map((p) => this.toListItem(p)));
  }

  // 07문서 §5 POST /programs — BRANCH_ADMIN 본인 지점에 등록.
  @Post()
  @Roles('BRANCH_ADMIN')
  create(@Body() dto: CreateProgramDto, @CurrentUser() user: RequestUser) {
    if (!user.branchId) {
      throw new AppException('BRANCH_REQUIRED', '소속 지점이 없는 계정입니다.', 403);
    }
    const program = this.mockData.createProgram(user.branchId, dto);
    return ok(this.toListItem(program));
  }

  @Patch(':id')
  @Roles('BRANCH_ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateProgramDto, @CurrentUser() user: RequestUser) {
    const program = this.findProgramOrThrow(id);
    this.assertOwnBranch(program, user);
    const updated = this.mockData.updateProgram(id, dto);
    return ok(this.toListItem(updated));
  }

  // 07문서 §5 상태 전이(§3-2 표의 허용 전이만 통과, 위반 시 409) — BRANCH_ADMIN 본인 지점만(§7).
  // ADR-PRG-02 — 응답에 이 프로그램의 오늘 이후 유효 예약 건수·목록을 포함해, 알림 인프라 없이도
  // 관리자가 "몇 명에게 영향이 가는지"를 전이 즉시 알 수 있게 한다.
  @Patch(':id/status')
  @Roles('BRANCH_ADMIN')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProgramStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    const program = this.findProgramOrThrow(id);
    this.assertOwnBranch(program, user);
    const updated = this.mockData.updateProgramStatus(id, dto.status);
    const affectedReservations = this.mockData.futureActiveReservationsForProgram(id);
    return ok({ ...this.toListItem(updated), affectedReservations });
  }

  // 07문서 §5 "삭제(소프트)" — 물리 삭제 대신 ENDED로 전이한다(mock-data.service.ts endProgram 참고).
  // ADR-PRG-02 — ENDED도 종결 전이라 PAUSED 못지않게 영향이 크므로 같은 정보를 포함한다.
  @Delete(':id')
  @Roles('BRANCH_ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const program = this.findProgramOrThrow(id);
    this.assertOwnBranch(program, user);
    const updated = this.mockData.endProgram(id);
    const affectedReservations = this.mockData.futureActiveReservationsForProgram(id);
    return ok({ ...this.toListItem(updated), affectedReservations });
  }

  // 06문서 §5 GET /programs/:id/slots?date= — 잔여좌석 조회. 로그인한 모든 역할이 조회할 수 있지만
  // SUPER_ADMIN 외에는 본인 소속 지점의 프로그램만(1-8문서 §7 기본 정책 "본인 지점만 노출").
  @Get(':id/slots')
  listSlots(@Param('id') id: string, @CurrentUser() user: RequestUser, @Query('date') date?: string) {
    const program = this.findProgramOrThrow(id);
    this.assertReadable(program, user);
    const slots = this.mockData.listScheduleSlots(id, date);
    return ok(slots.map((s) => ({ ...s, bookedCount: this.mockData.bookedCount(s.id) })));
  }

  // 06문서 §5(1-8문서 §5 소관) POST /programs/:id/slots — 회차 개별 추가, BRANCH_ADMIN 본인 지점만.
  @Post(':id/slots')
  @Roles('BRANCH_ADMIN')
  createSlot(@Param('id') id: string, @Body() dto: CreateScheduleSlotDto, @CurrentUser() user: RequestUser) {
    const program = this.findProgramOrThrow(id);
    this.assertOwnBranch(program, user);
    const slot = this.mockData.createScheduleSlot(id, dto);
    return ok({ ...slot, bookedCount: 0 });
  }

  private findProgramOrThrow(id: string): MockProgram {
    const program = this.mockData.findProgramById(id);
    if (!program) {
      throw new AppException('PROGRAM_NOT_FOUND', '프로그램을 찾을 수 없습니다.', 404);
    }
    return program;
  }

  private assertOwnBranch(program: MockProgram, user: RequestUser): void {
    if (program.branchId !== user.branchId) {
      throw new AppException('PROGRAM_SCOPE_VIOLATION', '다른 지점의 프로그램은 수정할 수 없습니다.', 403);
    }
  }

  private assertReadable(program: MockProgram, user: RequestUser): void {
    if (user.role === 'SUPER_ADMIN') return;
    if (program.branchId !== user.branchId) {
      throw new AppException('PROGRAM_SCOPE_VIOLATION', '다른 지점의 프로그램 회차는 조회할 수 없습니다.', 403);
    }
  }

  private toListItem(program: MockProgram) {
    return {
      ...program,
      branchName: this.mockData.findBranchById(program.branchId)?.name,
      instructorName: program.instructorId
        ? this.mockData.findInstructorById(program.instructorId)?.name
        : undefined,
    };
  }
}
