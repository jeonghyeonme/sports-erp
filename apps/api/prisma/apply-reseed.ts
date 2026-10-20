/**
 * 배포 DB 재시드 실행기(D58, log/142) — 로컬에서 만든 데이터 SQL(`pg_dump --data-only --inserts`)을
 * 대상 DB에 **한 트랜잭션으로** 적용한다: 앱 테이블 전부 TRUNCATE → INSERT 전부 → 행 수 출력 → COMMIT.
 * 중간에 하나라도 실패하면 전부 되돌아가 대상 DB는 손대기 전 그대로다.
 *
 *   DATABASE_URL=<대상> RESEED_CONFIRM_HOST=<대상 호스트> npx ts-node prisma/apply-reseed.ts <sql 파일>
 *
 * - RESEED_CONFIRM_HOST가 DATABASE_URL의 호스트와 같아야 돈다(다른 DB를 지우는 실수 방지).
 * - 배포 DB 쓰기는 사용자 승인 대상이다(CLAUDE.md) — 승인 뒤 사용자가 자기 PC에서 실행한다.
 * - 스키마는 바꾸지 않는다. 대상 스키마가 로컬 마이그레이션과 같은지는 실행 전에 지문으로 확인한다(log/142).
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

// 데이터 테이블 전부(_prisma_migrations 제외). 새 모델이 생기면 여기에 더한다 — 빠지면 그 테이블은 지워지지 않는다.
const TABLES = [
  'Account', 'Asset', 'Attachment', 'AttendanceRecord', 'AuditLog', 'Branch', 'CodeSequence', 'CongestionSnapshot',
  'CourseEnrollment', 'Document', 'Facility', 'FacilityCheckIn', 'Instructor', 'LeaveBalance', 'LeaveRequest', 'Member',
  'MemberLinkAttempt', 'PTSession', 'PTSessionLog', 'Payment', 'Post', 'PostReadReceipt', 'Program',
  'ProgramScheduleTemplate', 'RefreshToken', 'Reservation', 'ScheduleSlot', 'Staff', 'StaffAssignment',
  'StaffProfileChangeRequest', 'SupportRequest', 'WorkLog',
];

async function main() {
  const file = process.argv[2];
  const url = process.env.DATABASE_URL ?? '';
  if (!file || !url) throw new Error('사용법: DATABASE_URL=... RESEED_CONFIRM_HOST=... ts-node prisma/apply-reseed.ts <sql 파일>');
  const host = new URL(url).hostname;
  if (process.env.RESEED_CONFIRM_HOST !== host) {
    throw new Error(`대상 호스트 확인 실패 — RESEED_CONFIRM_HOST에 "${host}"를 그대로 넣어야 실행한다`);
  }

  // pg_dump는 INSERT마다 줄 맨 앞에서 시작한다. Prisma는 문장을 하나씩만 보내므로 그 경계로 나눈다.
  // pg_dump 16.10+는 psql 전용 줄(`\restrict`·`\unrestrict`)을 넣는다 — psql이 아니라서 버린다.
  const sql = readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => !line.startsWith('\\'))
    .join('\n');
  const statements = sql
    .split(/\n(?=INSERT INTO public\.)/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith('INSERT INTO public.'))
    .map((s) => s.replace(/;\s*(--[^\n]*\s*)*$/, ''));
  if (statements.length === 0) throw new Error('INSERT 문이 없다 — pg_dump --data-only --inserts 결과인지 확인할 것');
  console.log(`대상 ${host}: ${TABLES.length}개 테이블을 비우고 INSERT ${statements.length}문을 적용한다`);

  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const counts = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
        for (const s of statements) await tx.$executeRawUnsafe(s);
        const rows: Record<string, number> = {};
        for (const t of TABLES) {
          const [{ n }] = await tx.$queryRawUnsafe<Array<{ n: number }>>(`SELECT count(*)::int AS n FROM "${t}"`);
          rows[t] = n;
        }
        return rows;
      },
      { timeout: 300_000, maxWait: 30_000 },
    );
    console.log('적용 완료 — 행 수:');
    for (const [t, n] of Object.entries(counts)) console.log(`  ${t}: ${n}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
