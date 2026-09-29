/**
 * 테스트 DB 주소 — D29 결정 3(2-1_기술결정사항.md): jest 워커마다 별도 DB.
 *
 * 기준 DB(DATABASE_URL)는 CI·로컬 모두 `prisma migrate deploy` → `prisma:seed`가 끝난 상태여야 한다(CLAUDE.md 명령어 절).
 * globalSetup이 기준 DB를 템플릿으로 워커 수만큼 복제하고(`CREATE DATABASE … TEMPLATE`), 각 워커는 자기 DB만 쓴다.
 * 워커 안에서는 스위트가 순서대로 돌므로, 테스트가 DB 상태(예: 지점 계약 상태)를 바꿔도 다른 스위트와 섞이지 않는다.
 */
import path from 'path';

/** apps/api/.env가 있으면 읽는다(로컬). CI는 환경변수로 이미 주어진다. 이미 있는 값은 덮어쓰지 않는다. */
export function loadLocalEnv(): void {
  try {
    process.loadEnvFile(path.join(__dirname, '..', '..', '.env'));
  } catch {
    // 파일이 없으면(CI) 무시
  }
}

export function baseDatabaseUrl(): string | undefined {
  return process.env.TEST_BASE_DATABASE_URL ?? process.env.DATABASE_URL;
}

export function withDatabase(url: string, database: string): string {
  const u = new URL(url);
  u.pathname = `/${database}`;
  return u.toString();
}

export function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

export function workerDatabaseName(base: string, workerId: string | number): string {
  return `${databaseName(base)}_w${workerId}`;
}
