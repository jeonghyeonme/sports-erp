import { Module } from '@nestjs/common';
import { SupportRequestsController } from './support-requests.controller';
import { SupportRequestService } from './support-request.service';

// D56 — 업무지원 요청(현장→본사).
@Module({ controllers: [SupportRequestsController], providers: [SupportRequestService] })
export class SupportRequestsModule {}
