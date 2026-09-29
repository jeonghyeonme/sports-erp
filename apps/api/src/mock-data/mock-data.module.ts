import { Global, Module } from '@nestjs/common';
import { MockDataService } from './mock-data.service';

// D26(2026-09-28)부터 도메인별로 순차 이관 중 — 아직 이관 안 된 도메인만 이 모듈을 쓴다.
// 전 도메인 이관이 끝나면 이 모듈은 제거한다.
@Global()
@Module({
  providers: [MockDataService],
  exports: [MockDataService],
})
export class MockDataModule {}
