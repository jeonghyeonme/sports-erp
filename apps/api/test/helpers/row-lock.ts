import { PrismaClient } from '@prisma/client';

/**
 * 동시 요청의 순서를 결정적으로 만드는 도구 — engineering-risks R1·R2 재현(docs/log/123).
 * Promise.all만으로는 두 요청이 실제로 겹칠지 운에 맡겨진다. 테스트가 대상 행을 먼저 FOR UPDATE로 잡아 두고,
 * 요청들이 그 행에서 기다리는 것을 pg_stat_activity로 확인한 뒤 놓으면 "둘 다 읽은 뒤에 쓰기" 같은 순서를 매번 만든다.
 * 앱과 다른 연결(별도 PrismaClient)이어야 한다 — 앱 풀의 연결을 잡으면 요청이 연결을 못 얻어 다른 이유로 멈춘다.
 */
export async function holdRowLock(table: string, id: string): Promise<{ release: () => Promise<void> }> {
  const client = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  let unlock!: () => void;
  const unlocked = new Promise<void>((resolve) => (unlock = resolve));
  let onLocked!: () => void;
  const locked = new Promise<void>((resolve) => (onLocked = resolve));
  const held = client.$transaction(
    async (tx) => {
      await tx.$queryRawUnsafe(`SELECT 1 FROM "${table}" WHERE "id" = $1 FOR UPDATE`, id);
      onLocked();
      await unlocked;
    },
    { timeout: 30_000 },
  );
  await Promise.race([locked, held]);
  return {
    release: async () => {
      unlock();
      await held;
      await client.$disconnect();
    },
  };
}

/** 이 DB에서 행 락을 기다리는 연결이 count개가 될 때까지 기다린다(못 되면 실패 — 테스트가 의도한 순서가 아니다). */
export async function waitForLockWaiters(count: number, timeoutMs = 10_000): Promise<void> {
  const client = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  try {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const [{ n }] = await client.$queryRaw<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      if (n >= count) return;
      if (Date.now() > deadline) throw new Error(`행 락 대기 연결 ${count}개를 기다렸으나 ${n}개`);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  } finally {
    await client.$disconnect();
  }
}
