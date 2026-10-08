/**
 * 테스트 DB 주소 — D29 결정 3: jest 워커마다 별도 DB.
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

type RawExecutor = { $executeRawUnsafe(query: string): Promise<number> };
const errorCode = (e: unknown) => (e as { meta?: { code?: string } }).meta?.code ?? String(e);

/**
 * 테스트 DB 삭제 — D32에서 드러난 간헐 실패 대응.
 *
 * `WITH (FORCE)`는 그 DB에 붙은 모든 프로세스를 호출자 권한으로 종료하려 한다. 테스트가 DB에 쓴 직후 PostgreSQL
 * autovacuum이 그 DB에서 돌고 있으면, 테스트 계정(비superuser)은 그 프로세스를 종료할 권한이 없어 42501로 실패한다
 * (D32로 테스트마다 DB를 다시 만드는 스위트가 늘며 자주 보이게 됐고, D30 로그의 "설명 안 된 smoke 실패"도 같은 원인
 * 후보다). FORCE 없는 DROP은 서버가 autovacuum을 직접 멈추고 기다리므로 권한이 필요 없다. 그래서 FORCE를 먼저 쓰고,
 * 권한 오류면 FORCE 없이, 아직 다른 연결이 남아 있으면(55006 — 방금 닫은 앱의 연결 정리 지연) 잠깐 기다렸다 다시 한다.
 */
export async function dropDatabase(admin: RawExecutor, name: string): Promise<void> {
  const force = `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`;
  const plain = `DROP DATABASE IF EXISTS "${name}"`;
  for (let attempt = 0; ; attempt++) {
    try {
      await admin.$executeRawUnsafe(attempt === 0 ? force : plain);
      return;
    } catch (e) {
      const code = errorCode(e);
      const retryable = code.includes('42501') || code.includes('55006');
      if (!retryable || attempt >= 20) throw e;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

/**
 * ADR-RSV-05 — 시드 회차 2건(`slot-seocho-yoga-1`·`-2`, catalog-fixtures.ts)은 고정 날짜(2026-09-21·22)라, 그 날이 지나면
 * "지난 회차"가 되어 예약이 409(SLOT_ALREADY_STARTED)다. 이 회차를 예약하는 테스트가 실행 날짜와 상관없이 돌도록
 * 워커 DB를 만들 때마다 오늘(KST)+7일·+8일로 옮긴다. 순서(1이 2보다 먼저)는 그대로다. 기준 DB와 시드 원천은 바꾸지 않는다.
 * 지난 회차가 필요한 테스트는 회차를 직접 만들거나 날짜를 과거로 돌린다.
 */
export async function moveSeedSlotsToFuture(databaseUrl: string): Promise<void> {
  // 이 파일은 globalSetup(ts-jest 변환)에서도 쓰이므로 PrismaClient를 여기서 직접 만든다.
  const { PrismaClient } = await import('@prisma/client');
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const kstDaysFromNow = (days: number) =>
    new Date(Date.now() + days * 86_400_000 + 9 * 3_600_000).toISOString().slice(0, 10);
  try {
    for (const [id, days] of [
      ['slot-seocho-yoga-1', 7],
      ['slot-seocho-yoga-2', 8],
    ] as const) {
      await client.scheduleSlot.updateMany({ where: { id }, data: { date: new Date(`${kstDaysFromNow(days)}T00:00:00Z`) } });
    }
  } finally {
    await client.$disconnect();
  }
}
