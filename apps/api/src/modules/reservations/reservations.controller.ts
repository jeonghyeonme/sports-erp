import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { MockDataService } from '../../mock-data/mock-data.service';
import { AppException } from '../../common/exceptions/app.exception';
import { MockReservation } from '../../mock-data/mock-data.types';
import { ok } from '../../common/http/api-response';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { CancelReservationDto } from './dto/cancel-reservation.dto';

// 06문서 §5·§7 — 회원은 본인 예약만, BRANCH_ADMIN은 본인 지점 프로그램에 연결된 예약만.
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly mockData: MockDataService) {}

  @Post()
  @Roles('MEMBER')
  create(@Body() dto: CreateReservationDto, @CurrentUser() user: RequestUser) {
    if (!user.memberId) {
      throw new AppException('MEMBER_REQUIRED', '회원 계정이 아닙니다.', 403);
    }
    const { reservation, payment } = this.mockData.createReservation(user.memberId, dto.scheduleSlotId);
    return ok({ ...this.toListItem(reservation), payment });
  }

  // ADR-MEM-03 — 회원 상세 "예약·결제 내역" 탭이 ?memberId=로 특정 회원의 이력을 조회한다(관리자 전용).
  @Get()
  @Roles('MEMBER', 'BRANCH_ADMIN', 'SUPER_ADMIN')
  list(
    @Query('status') status: string | undefined,
    @Query('memberId') memberId: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    let reservations = this.mockData.reservations;
    if (user.role === 'MEMBER') {
      if (!user.memberId) {
        throw new AppException('MEMBER_REQUIRED', '회원 계정이 아닙니다.', 403);
      }
      reservations = reservations.filter((r) => r.memberId === user.memberId);
    } else if (memberId) {
      const member = this.mockData.findMemberById(memberId);
      if (!member) {
        throw new AppException('MEMBER_NOT_FOUND', '회원을 찾을 수 없습니다.', 404);
      }
      if (user.role === 'BRANCH_ADMIN' && member.branchId !== user.branchId) {
        throw new AppException('RESERVATION_SCOPE_VIOLATION', '다른 지점 회원의 예약은 조회할 수 없습니다.', 403);
      }
      reservations = reservations.filter((r) => r.memberId === memberId);
    } else if (user.role === 'BRANCH_ADMIN') {
      reservations = reservations.filter((r) => this.branchIdOf(r) === user.branchId);
    }
    if (status) reservations = reservations.filter((r) => r.status === status);
    return ok(reservations.map((r) => this.toListItem(r)));
  }

  @Patch(':id/cancel')
  @Roles('MEMBER', 'BRANCH_ADMIN')
  cancel(@Param('id') id: string, @Body() dto: CancelReservationDto, @CurrentUser() user: RequestUser) {
    const reservation = this.findReservationOrThrow(id);
    this.assertCanManage(reservation, user);
    const updated = this.mockData.cancelReservation(id, dto.reason);
    return ok(this.toListItem(updated));
  }

  @Patch(':id/check-in')
  @Roles('BRANCH_ADMIN')
  checkIn(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    const reservation = this.findReservationOrThrow(id);
    this.assertOwnBranch(reservation, user);
    const updated = this.mockData.checkInReservation(id);
    return ok(this.toListItem(updated));
  }

  private branchIdOf(reservation: MockReservation): string | undefined {
    const slot = this.mockData.findScheduleSlotById(reservation.scheduleSlotId);
    const program = slot ? this.mockData.findProgramById(slot.programId) : undefined;
    return program?.branchId;
  }

  private toListItem(reservation: MockReservation) {
    const slot = this.mockData.findScheduleSlotById(reservation.scheduleSlotId);
    const program = slot ? this.mockData.findProgramById(slot.programId) : undefined;
    const member = this.mockData.findMemberById(reservation.memberId);
    const payment = this.mockData.findPaymentByReservationId(reservation.id);
    return {
      ...reservation,
      slot,
      programId: program?.id,
      programName: program?.name,
      branchId: program?.branchId,
      branchName: program ? this.mockData.findBranchById(program.branchId)?.name : undefined,
      memberName: member?.name,
      payment,
    };
  }

  private findReservationOrThrow(id: string): MockReservation {
    const reservation = this.mockData.findReservationById(id);
    if (!reservation) {
      throw new AppException('RESERVATION_NOT_FOUND', '예약을 찾을 수 없습니다.', 404);
    }
    return reservation;
  }

  private assertOwnBranch(reservation: MockReservation, user: RequestUser): void {
    if (this.branchIdOf(reservation) !== user.branchId) {
      throw new AppException('RESERVATION_SCOPE_VIOLATION', '다른 지점의 예약은 관리할 수 없습니다.', 403);
    }
  }

  private assertCanManage(reservation: MockReservation, user: RequestUser): void {
    if (user.role === 'MEMBER') {
      if (reservation.memberId !== user.memberId) {
        throw new AppException('RESERVATION_SCOPE_VIOLATION', '본인 예약만 취소할 수 있습니다.', 403);
      }
      return;
    }
    this.assertOwnBranch(reservation, user);
  }
}
