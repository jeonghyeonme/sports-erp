import { Global, Module } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchService } from './branch.service';

// D29 — 여러 도메인 컨트롤러가 계약 종료 판정(BranchService.loadGate)을 쓰므로 전역으로 제공한다.
@Global()
@Module({ controllers: [BranchesController], providers: [BranchService], exports: [BranchService] })
export class BranchesModule {}
