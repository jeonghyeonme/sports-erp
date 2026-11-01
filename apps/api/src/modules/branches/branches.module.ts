import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchService } from './branch.service';
import { ContractFileService } from './contract-file.service';

// D70 — 계약 종료 판정은 각 도메인이 쓰기 트랜잭션 안에서 지점 행 공유 락으로 한다(integrity.ts lockBranchForShare).
// 예전에는 다른 도메인이 BranchService.loadGate()를 불러 전역으로 제공했지만(D29) 이제 지점 모듈 밖에서 쓰지 않는다.
@Module({ controllers: [BranchesController], providers: [BranchService, ContractFileService] })
export class BranchesModule {}
