import { Global, Module } from '@nestjs/common';
import { MockDataService } from './mock-data.service';

// Phase 1 스캐폴딩 단계 전용 — 실제 DB 연동 시 이 모듈은 제거하고
// 각 기능 모듈이 PrismaService를 직접 사용하도록 바꿉니다.
@Global()
@Module({
  providers: [MockDataService],
  exports: [MockDataService],
})
export class MockDataModule {}
