import { Module } from '@nestjs/common';
import { InstructorsController } from './instructors.controller';

@Module({ controllers: [InstructorsController] })
export class InstructorsModule {}
