import { Module } from '@nestjs/common';
import { FacilitiesController } from './facilities.controller';
import { FacilityService } from './facility.service';

// D31 — 시설 원천은 DB(FacilityService), mock에는 미러.
@Module({ controllers: [FacilitiesController], providers: [FacilityService], exports: [FacilityService] })
export class FacilitiesModule {}
