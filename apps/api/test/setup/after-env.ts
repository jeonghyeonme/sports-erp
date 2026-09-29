import { disconnectTestDb, restoreBranchStatuses } from '../helpers/branch-status';

// D29 — 테스트가 바꾼 지점 계약 상태를 매 테스트 뒤에 원래대로 돌린다(같은 워커의 다음 테스트를 위해).
// 앱 수명과 무관하게 동작하도록 헬퍼 전용 PrismaClient를 쓴다.
afterEach(async () => {
  await restoreBranchStatuses();
});
afterAll(async () => {
  await disconnectTestDb();
});
