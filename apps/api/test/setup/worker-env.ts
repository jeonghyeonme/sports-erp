import { baseDatabaseUrl, loadLocalEnv, withDatabase, workerDatabaseName } from './test-db';

// D29 — 이 워커의 모든 PrismaClient(앱·테스트 헬퍼)가 워커 전용 DB를 보게 한다. 앱이 뜨기 전에 실행된다.
loadLocalEnv();
const base = baseDatabaseUrl();
if (base) {
  const url = withDatabase(base, workerDatabaseName(base, process.env.JEST_WORKER_ID ?? '1'));
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
}
