import { Module } from '@nestjs/common';
import { InstructorsController } from './instructors.controller';
import { InstructorService } from './instructor.service';

// D31 — 강사 원천은 DB(InstructorService), mock에는 미러. 직원 파견(StaffModule)이 미러 갱신에 쓴다.
@Module({ controllers: [InstructorsController], providers: [InstructorService], exports: [InstructorService] })
export class InstructorsModule {}
