import { Module } from '@nestjs/common';
import { ProgramsController } from './programs.controller';
import { ProgramService } from './program.service';

// D31 — 프로그램·회차 원천은 DB(ProgramService), mock에는 미러.
@Module({ controllers: [ProgramsController], providers: [ProgramService], exports: [ProgramService] })
export class ProgramsModule {}
