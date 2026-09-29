import { PrismaClient } from '@prisma/client';
import { baseDatabaseUrl, databaseName, withDatabase } from '../setup/test-db';
import { disconnectTestDb } from './branch-status';

/**
 * 이 워커의 DB를 기준 DB(마이그레이션·시드 완료)로 되돌린다 — D30. 템플릿 복제라 1초 안팎이다.
 *
 * D29부터 워커마다 DB를 따로 쓰지만, 같은 워커 안의 파일·테스트끼리는 DB 상태가 이어진다. mock 시절의
 * "새 앱 = 새 상태" 격리를 기대하던 테스트(예: 파견 후 퇴사 검증)를 위해 두 단계로 되돌린다.
 * - 파일 단위: setup/after-env.ts가 모든 테스트 파일 시작 전에 자동으로 부른다.
 * - 테스트 단위: 테스트마다 깨끗한 DB가 필요한 스위트는 beforeEach에서 **앱을 띄우기 전에** 직접 부른다.
 * 앱이 열려 있으면 그 연결은 강제로 끊기므로 반드시 앱을 닫은 뒤에 부를 것.
 */
export async function resetWorkerDb(): Promise<void> {
  const base = baseDatabaseUrl();
  const worker = process.env.DATABASE_URL;
  if (!base || !worker || worker === base) return; // 워커 DB가 없는 실행(직접 실행 등)에서는 아무것도 안 한다
  await disconnectTestDb();
  const admin = new PrismaClient({ datasourceUrl: withDatabase(base, 'postgres') });
  try {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName(worker)}" WITH (FORCE)`);
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName(worker)}" TEMPLATE "${databaseName(base)}"`);
  } finally {
    await admin.$disconnect();
  }
}
