import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentService } from './payment.service';
import { ReservationsModule } from '../reservations/reservations.module';

// D32 — 결제 원천은 DB(PaymentService).
@Module({ imports: [ReservationsModule], controllers: [PaymentsController], providers: [PaymentService] })
export class PaymentsModule {}
