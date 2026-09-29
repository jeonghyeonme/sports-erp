import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationService } from './reservation.service';

// D32 — 예약 원천은 DB(ReservationService). 결제(PaymentsModule)가 예약 조회에 같은 서비스를 쓴다.
@Module({ controllers: [ReservationsController], providers: [ReservationService], exports: [ReservationService] })
export class ReservationsModule {}
