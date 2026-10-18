/**
 * 시연용 고밀도 데이터 층 실행기 — D58. 기준 시드(prisma/seed.ts) 다음에 돈다: `npm run seed:demo --workspace=apps/api`.
 * 원격 DB(배포 Supabase 등)에는 쓰지 않는다 — 배포 DB 쓰기는 사용자 승인이 필요하다(CLAUDE.md). 승인을 받은 뒤에만
 * DEMO_SEED_ALLOW_REMOTE=yes로 막음을 푼다.
 */
import { PrismaClient } from '@prisma/client';
import { applyDemoLayer } from './demo-layer';

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  })();
  if (!['localhost', '127.0.0.1', 'db'].includes(host) && process.env.DEMO_SEED_ALLOW_REMOTE !== 'yes') {
    throw new Error(`로컬이 아닌 DB(${host || '알 수 없음'})에는 시연 데이터를 얹지 않는다 — 승인 후 DEMO_SEED_ALLOW_REMOTE=yes`);
  }
  const prisma = new PrismaClient();
  try {
    const started = Date.now();
    const { today, counts } = await applyDemoLayer(prisma);
    console.log(`시연 데이터 층 완료(기준일 ${today}, ${((Date.now() - started) / 1000).toFixed(1)}초):`);
    for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
