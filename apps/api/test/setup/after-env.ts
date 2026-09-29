import { disconnectTestDb, restoreBranchStatuses } from '../helpers/branch-status';
import { resetWorkerDb } from '../helpers/worker-db';

// D30 — 테스트 파일마다 워커 DB를 기준 DB로 되돌려, 같은 워커에서 앞 파일이 바꾼 상태가 넘어오지 않게 한다.
beforeAll(async () => {
  await resetWorkerDb();
});
// D29 — 테스트가 바꾼 지점 계약 상태를 매 테스트 뒤에 원래대로 돌린다(같은 파일의 다음 테스트를 위해).
// 앱 수명과 무관하게 동작하도록 헬퍼 전용 PrismaClient를 쓴다.
afterEach(async () => {
  await restoreBranchStatuses();
});
afterAll(async () => {
  await disconnectTestDb();
});
