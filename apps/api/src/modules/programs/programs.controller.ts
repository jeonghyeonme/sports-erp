import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { ScopedResource } from '../../common/decorators/scoped-resource.decorator';
import { ProgramService } from './program.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ok } from '../../common/http/api-response';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { UpdateProgramStatusDto } from './dto/update-program-status.dto';
import { CreateScheduleSlotDto } from './dto/create-schedule-slot.dto';

// 강사프로그램게시 A-7 — 회원 포함 모든 역할이 조회 가능(본인 소속 지점 기준 필터 기본 적용).
// D46 — 지점 범위(branchId·:id 소유)는 전역 BranchScopeGuard가 본다.
@Controller('programs')
export class ProgramsController {
  constructor(private readonly programService: ProgramService) {}

  @Get()
  async list(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('pricingType') pricingType?: string,
  ) {
    return ok(await this.programService.list({ branchId, status, pricingType }));
  }

  // 강사프로그램게시 A-5 POST /programs — BRANCH_ADMIN 본인 지점에 등록.
  @Post()
  @Roles('BRANCH_ADMIN')
  async create(@Body() dto: CreateProgramDto, @CurrentUser() user: RequestUser) {
    if (!user.branchId) {
      throw new AppException('BRANCH_REQUIRED', '소속 지점이 없는 계정입니다.', 403);
    }
    return ok(await this.programService.create(user.branchId, dto));
  }

  @Patch(':id')
  @Roles('BRANCH_ADMIN')
  @ScopedResource('program')
  async update(@Param('id') id: string, @Body() dto: UpdateProgramDto) {
    return ok(await this.programService.update(id, dto));
  }

  // 강사프로그램게시 A-5 상태 전이(A-3 §3-2 표의 허용 전이만 통과, 위반 시 409) — BRANCH_ADMIN 본인 지점만(A-7).
  // ADR-PRG-02 — 응답에 이 프로그램의 오늘 이후 유효 예약 건수·목록을 포함해, 알림 인프라 없이도
  // 관리자가 "몇 명에게 영향이 가는지"를 전이 즉시 알 수 있게 한다. 예약도 D32부터 DB에서 센다.
  @Patch(':id/status')
  @Roles('BRANCH_ADMIN')
  @ScopedResource('program')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateProgramStatusDto) {
    const updated = await this.programService.updateStatus(id, dto.status);
    const affectedReservations = await this.programService.futureActiveReservations(id);
    return ok({ ...updated, affectedReservations });
  }

  // 강사프로그램게시 A-5 "삭제(소프트)" — 물리 삭제 대신 ENDED로 전이한다.
  // ADR-PRG-02 — ENDED도 종결 전이라 PAUSED 못지않게 영향이 크므로 같은 정보를 포함한다.
  @Delete(':id')
  @Roles('BRANCH_ADMIN')
  @ScopedResource('program')
  async remove(@Param('id') id: string) {
    const updated = await this.programService.updateStatus(id, 'ENDED');
    const affectedReservations = await this.programService.futureActiveReservations(id);
    return ok({ ...updated, affectedReservations });
  }

  // 예약및결제 A-5 GET /programs/:id/slots?date= — 잔여좌석 조회. 로그인한 모든 역할이 조회할 수 있지만
  // SUPER_ADMIN 외에는 본인 소속 지점의 프로그램만(강사프로그램게시 A-7 기본 정책 "본인 지점만 노출").
  @Get(':id/slots')
  @ScopedResource('program')
  async listSlots(@Param('id') id: string, @Query('date') date?: string) {
    return ok(await this.programService.listSlots(id, date));
  }

  // 강사프로그램게시 A-5 POST /programs/:id/slots — 회차 개별 추가, BRANCH_ADMIN 본인 지점만.
  @Post(':id/slots')
  @Roles('BRANCH_ADMIN')
  @ScopedResource('program')
  async createSlot(@Param('id') id: string, @Body() dto: CreateScheduleSlotDto) {
    return ok(await this.programService.createSlot(id, dto));
  }
}
