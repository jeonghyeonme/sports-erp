// 화면 테스트 전용 DB를 비우고 기준 시드(5곳, D58)를 다시 넣는다(D59). api를 띄우기 전에 부른다 —
// Playwright는 webServer를 globalSetup보다 먼저 띄우므로 api 시작 명령 앞에 붙였다(playwright.config.ts).
// 테스트가 데이터를 바꾸므로(회원 등록·예약·게시글) 실행마다 같은 출발점에서 시작한다. jest 기준 DB와는 다른 DB다.
import { execSync } from 'node:child_process';

const url = process.env.DATABASE_URL;
if (!url || !/\/sports_erp_e2e(\?|$)/.test(url)) {
  console.error('reset-db: DATABASE_URL이 화면 테스트 전용 DB(sports_erp_e2e)가 아니다 — 다른 DB는 지우지 않는다');
  process.exit(1);
}
const root = new URL('..', import.meta.url).pathname;
const run = (cmd) => execSync(cmd, { cwd: root, env: { ...process.env, DIRECT_URL: url }, stdio: 'inherit' });
// 시드 설정(prisma.seed)은 apps/api/package.json에 있어 reset이 자동으로 부르지 못한다 — 따로 부른다.
run('npx prisma migrate reset --force --skip-generate --skip-seed --schema=apps/api/prisma/schema.prisma');
run('npm run prisma:seed --workspace=apps/api');
