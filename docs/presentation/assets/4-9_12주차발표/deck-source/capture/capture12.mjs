// 4-9 12주차 발표 캡처 — 계약 갱신 리포트(화면·인쇄본)와 800px 폭 변경 전·후(예약 관리 필터 줄·문서함 표).
// 화면 테스트 전용 DB(sports_erp_e2e)를 비우고 기준 시드 + 시연 데이터 층(D58)을 넣은 뒤, 빌드한 api와 관리자 웹을 띄워 찍는다.
// 변경 전 = log/228 수정(#158) 직전 화면: 지금 관리자 웹을 복사해 예약 필터 줄의 flexWrap과 .table-scroll 규칙만 뺀 빌드
// (README "변경 전 빌드"), 같은 api에 붙인다. 사용(저장소 루트, e2e 폴더에서): node <이 파일> <출력 폴더> [변경 전 dist 서버 스크립트]
import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';

const OUT = process.argv[2];
const OLD_SERVE = process.argv[3];
const ROOT = new URL('../../../../../../', import.meta.url).pathname;
const DB = 'postgresql://sports_erp:change-me-in-local-env@localhost:5432/sports_erp_e2e?schema=public';
const env = { ...process.env, DATABASE_URL: DB, DIRECT_URL: DB };
execSync('node e2e/reset-db.mjs', { cwd: ROOT, env, stdio: 'ignore' });
execSync('npx ts-node prisma/seed-demo.ts', { cwd: `${ROOT}apps/api`, env, stdio: 'ignore' });
const procs = [
  spawn('node', ['apps/api/dist/main.js'], { cwd: ROOT, env: { ...env, PORT: '3111' }, stdio: 'ignore' }),
  spawn('node', ['e2e/serve.mjs'], { cwd: ROOT, env: { ...process.env, E2E_WEB_PORT: '4311', E2E_API_ORIGIN: 'http://localhost:3111' }, stdio: 'ignore' }),
];
if (OLD_SERVE) procs.push(spawn('node', [OLD_SERVE], { cwd: ROOT, env: { ...process.env, E2E_WEB_PORT: '4312', E2E_API_ORIGIN: 'http://localhost:3111' }, stdio: 'ignore' }));
const stop = () => procs.forEach((p) => p.kill());
process.on('exit', stop);
for (let i = 0; i < 60; i++) {
  try { if ((await fetch('http://localhost:3111/api/v1/health')).ok) break; } catch { /* 아직 */ }
  await new Promise((r) => setTimeout(r, 1000));
}
await new Promise((r) => setTimeout(r, 1500));

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const settle = (page) => page.waitForLoadState('networkidle').then(() => page.waitForTimeout(600));
const go = (page, path) => page.evaluate((p) => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')); }, path);
// 머리말의 개발용 설명(결정 번호 등)만 숨긴다(4-0 §5)
const hideDev = (page) => page.evaluate(() => {
  for (const el of document.querySelectorAll('.page-header .page-desc')) {
    if (/\bD\d+\b|ADR-|SUPER_ADMIN|BRANCH_ADMIN/.test(el.textContent ?? '')) el.style.display = 'none';
  }
});
async function login(base, email, viewport, scale = 2) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
  const page = await ctx.newPage();
  await page.goto(`${base}/login`);
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill('demo-password-1234');
  await page.locator('button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.endsWith('/login'));
  await settle(page);
  return { ctx, page };
}

// 1) 계약 갱신 리포트 — 갱신 임박 마포점, 본사(정하늘)
{
  const { ctx, page } = await login('http://localhost:4311', 'jeong.haneul@spoism.example', { width: 1440, height: 900 });
  await go(page, '/branches/branch-mapo');
  await page.getByRole('link', { name: '갱신 리포트' }).waitFor();
  await page.getByRole('link', { name: '갱신 리포트' }).evaluate((el) => {
    el.style.outline = '4px solid #E0592A';
    el.style.outlineOffset = '4px';
  });
  await page.screenshot({ path: `${OUT}/branch-report-button.png` });
  await go(page, '/branches/branch-mapo/renewal-report');
  await page.locator('main h3', { hasText: '3. 서비스' }).waitFor();
  await settle(page);
  await page.screenshot({ path: `${OUT}/report-top.png` });
  await page.screenshot({ path: `${OUT}/report-full.png`, fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: `${OUT}/report-print.pdf`, format: 'A4', printBackground: true });
  await ctx.close();
}

// 2) 800px 폭 — 예약 관리 필터 줄, 문서함 표. 변경 전(4312)·후(4311), 지점 관리자(김민수, 서초점)
for (const [tag, base] of [['after', 'http://localhost:4311'], ...(OLD_SERVE ? [['before', 'http://localhost:4312']] : [])]) {
  const { ctx, page } = await login(base, 'kim.minsu@spoism.example', { width: 800, height: 900 });
  for (const [name, path] of [['reservations', '/reservations'], ['documents', '/documents']]) {
    await go(page, path);
    await settle(page);
    await page.locator('main .loading-state').waitFor({ state: 'detached' }).catch(() => {});
    await hideDev(page);
    await page.screenshot({ path: `${OUT}/narrow-${name}-${tag}.png` });
  }
  await ctx.close();
}
await browser.close();
stop();
