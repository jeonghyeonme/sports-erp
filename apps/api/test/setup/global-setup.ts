import { PrismaClient } from '@prisma/client';
import { applyDemoLayer } from '../../prisma/demo-layer';
import {
  baseDatabaseUrl,
  databaseName,
  denseDatabaseName,
  dropDatabase,
  loadLocalEnv,
  moveSeedSlotsToFuture,
  withDatabase,
  workerDatabaseName,
} from './test-db';

/**
 * D29 — 마이그레이션·시드가 끝난 기준 DB를 워커 수만큼 복제한다. 템플릿 복제라 워커당 1초 안팎이다.
 * D58 — 고밀도 템플릿(`<기준>_dense`)도 여기서 한 번 만든다(시연 데이터 층, 수 초).
 */
export default async function globalSetup(globalConfig: { maxWorkers: number }): Promise<void> {
  loadLocalEnv();
  const base = baseDatabaseUrl();
  if (!base) throw new Error('테스트에는 DATABASE_URL(마이그레이션·시드가 끝난 기준 DB)이 필요하다 — CLAUDE.md 명령어 절');
  process.env.TEST_BASE_DATABASE_URL = base; // 워커가 자기 DB 주소를 만들 때 기준으로 쓴다

  // 템플릿 DB에 연결이 남아 있으면 복제가 실패하므로 관리 DB(postgres)에 붙어서 실행한다.
  const admin = new PrismaClient({ datasourceUrl: withDatabase(base, 'postgres') });
  try {
    // D58 — 고밀도 템플릿: 기준 DB 복제 위에 시연 데이터 층을 얹는다. useDenseTemplate()을 부른 파일만 이걸로 워커 DB를 만든다.
    const dense = denseDatabaseName(base);
    await dropDatabase(admin, dense);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dense}" TEMPLATE "${databaseName(base)}"`);
    const denseClient = new PrismaClient({ datasourceUrl: withDatabase(base, dense) });
    try {
      await applyDemoLayer(denseClient);
    } finally {
      await denseClient.$disconnect();
    }
    for (let i = 1; i <= globalConfig.maxWorkers; i++) {
      const name = workerDatabaseName(base, i);
      await dropDatabase(admin, name);
      await admin.$executeRawUnsafe(`CREATE DATABASE "${name}" TEMPLATE "${databaseName(base)}"`);
      await moveSeedSlotsToFuture(withDatabase(base, name));
    }
  } finally {
    await admin.$disconnect();
  }
}
