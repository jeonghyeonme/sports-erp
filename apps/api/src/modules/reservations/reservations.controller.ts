import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { ReservationService, ReservationView } from './reservation.service';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ok } from '../../common/http/api-response';
import { pageMeta, parsePage } from '../../common/http/pagination';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { CancelReservationDto } from './dto/cancel-reservation.dto';

// 예약및결제 A-5·A-7 — 회원은 본인 예약만, BRANCH_ADMIN은 본인 지점 프로그램에 연결된 예약만.
@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly reservationService: ReservationService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('MEMBER')
  async create(@Body() dto: CreateReservationDto, @CurrentUser() user: RequestUser) {
    if (!user.memberId) {
      throw new AppException('MEMBER_REQUIRED', '회원 계정이 아닙니다.', 403);
    }
    const { reservation, payment } = await this.reservationService.create(user.memberId, dto.scheduleSlotId);
    return ok({ ...reservation, payment });
  }

  // ADR-MEM-03 — 회원 상세 "예약·결제 내역" 탭이 ?memberId=로 특정 회원의 이력을 조회한다(관리자 전용).
  @Get()
  @Roles('MEMBER', 'BRANCH_ADMIN', 'SUPER_ADMIN')
  async list(
    @Query('status') status: string | undefined,
    @Query('memberId') memberId: string | undefined,
    @CurrentUser() user: RequestUser,
    @Query('page') pageQuery?: string,
    @Query('limit') limitQuery?: string,
  ) {
    // D43 — offset 페이지네이션(page·limit, 상한 100), 최근 것부터.
    const page = parsePage(pageQuery, limitQuery);
    const paged = async (filter: { memberId?: string; branchId?: string; status?: string }) => {
      const { items, total } = await this.reservationService.list(filter, page);
      return ok(items, pageMeta(page, total));
    };
    if (user.role === 'MEMBER') {
      if (!user.memberId) {
        throw new AppException('MEMBER_REQUIRED', '회원 계정이 아닙니다.', 403);
      }
      return paged({ memberId: user.memberId, status });
    }
    if (memberId) {
      const member = await this.prisma.member.findUnique({ where: { id: memberId }, select: { branchId: true } });
      if (!member) {
        throw new AppException('MEMBER_NOT_FOUND', '회원을 찾을 수 없습니다.', 404);
      }
      if (user.role === 'BRANCH_ADMIN' && member.branchId !== user.branchId) {
        throw new AppException('RESERVATION_SCOPE_VIOLATION', '다른 지점 회원의 예약은 조회할 수 없습니다.', 403);
      }
      return paged({ memberId, status });
    }
    const branchId = user.role === 'BRANCH_ADMIN' ? user.branchId : undefined;
    return paged({ branchId, status });
  }

  @Patch(':id/cancel')
  @Roles('MEMBER', 'BRANCH_ADMIN')
  async cancel(@Param('id') id: string, @Body() dto: CancelReservationDto, @CurrentUser() user: RequestUser) {
    this.assertCanManage(await this.findReservationOrThrow(id), user);
    return ok(await this.reservationService.cancel(id, dto.reason));
  }

  @Patch(':id/check-in')
  @Roles('BRANCH_ADMIN')
  async checkIn(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    this.assertOwnBranch(await this.findReservationOrThrow(id), user);
    return ok(await this.reservationService.checkIn(id));
  }

  private async findReservationOrThrow(id: string): Promise<ReservationView> {
    const reservation = await this.reservationService.findById(id);
    if (!reservation) {
      throw new AppException('RESERVATION_NOT_FOUND', '예약을 찾을 수 없습니다.', 404);
    }
    return reservation;
  }

  private assertOwnBranch(reservation: ReservationView, user: RequestUser): void {
    if (reservation.branchId !== user.branchId) {
      throw new AppException('RESERVATION_SCOPE_VIOLATION', '다른 지점의 예약은 관리할 수 없습니다.', 403);
    }
  }

  private assertCanManage(reservation: ReservationView, user: RequestUser): void {
    if (user.role === 'MEMBER') {
      if (reservation.memberId !== user.memberId) {
        throw new AppException('RESERVATION_SCOPE_VIOLATION', '본인 예약만 취소할 수 있습니다.', 403);
      }
      return;
    }
    this.assertOwnBranch(reservation, user);
  }
}
