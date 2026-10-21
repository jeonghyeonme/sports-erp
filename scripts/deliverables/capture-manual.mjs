// 사용자 매뉴얼·빠른 시작(manual.js)에 넣을 화면 캡처 — RFP 과업4·산출물5(log/152).
//   npm run build --workspace=apps/api && npm run build:web
//   PW_CHROMIUM_PATH=... node scripts/deliverables/capture-manual.mjs   → scripts/deliverables/figs/manual/*.png
// 화면 테스트 전용 DB(sports_erp_e2e, D59)를 비우고 기준 시드 + 시연 데이터 층(D58)을 넣은 뒤, 빌드한 api·웹을
// 화면 테스트와 같은 구조(e2e/serve.mjs)로 띄워 역할별로 찍는다. 배포 환경에는 닿지 않는다.
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = new URL('../..', import.meta.url).pathname;
const OUT = new URL('./figs/manual/', import.meta.url).pathname;
const DB = process.env.E2E_DATABASE_URL ?? 'postgresql://sports_erp:change-me-in-local-env@localhost:5432/sports_erp_e2e?schema=public';
const API_PORT = 3101;
const WEB_PORT = 4301;
const BASE = `http://localhost:${WEB_PORT}`;
const env = { ...process.env, DATABASE_URL: DB, DIRECT_URL: DB };

mkdirSync(OUT, { recursive: true });
execSync('node e2e/reset-db.mjs', { cwd: ROOT, env, stdio: 'inherit' });
execSync('npx ts-node prisma/seed-demo.ts', { cwd: `${ROOT}apps/api`, env, stdio: 'inherit' });

const procs = [
  spawn('node', ['apps/api/dist/main.js'], { cwd: ROOT, env: { ...env, PORT: String(API_PORT) }, stdio: 'ignore' }),
  spawn('node', ['e2e/serve.mjs'], {
    cwd: ROOT,
    env: { ...process.env, E2E_WEB_PORT: String(WEB_PORT), E2E_API_ORIGIN: `http://localhost:${API_PORT}` },
    stdio: 'ignore',
  }),
];
const stop = () => procs.forEach((p) => p.kill());
process.on('exit', stop);

async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* 아직 안 떴다 */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${url} 응답 없음`);
}
await waitFor(`http://localhost:${API_PORT}/api/v1/health`);
await waitFor(`${BASE}/`);

const PASSWORD = 'demo-password-1234';
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});

// 관리자 웹은 토큰을 메모리에만 둔다 — 새로고침 대신 앱 안에서 경로를 바꾼다.
const go = (page, path) =>
  page.evaluate((p) => {
    history.pushState({}, '', p);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);
const settle = (page) => page.waitForLoadState('networkidle').then(() => page.waitForTimeout(400));

async function admin(email, shots) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.endsWith('/login'));
  for (const [name, path, prepare] of shots) {
    if (path) await go(page, path);
    await settle(page);
    if (prepare) await prepare(page);
    await settle(page);
    await page.screenshot({ path: `${OUT}${name}.png` });
    console.log('찍음', name);
  }
  await ctx.close();
}

await admin('jeong.haneul@spoism.example', [
  ['hq-dashboard', '/'],
  ['hq-branch', '/branches/branch-seocho'],
  ['hq-staff', '/staff'],
  ['hq-permissions', '/permissions', (p) => p.getByRole('button', { name: '역할 기본 권한' }).click()],
  ['hq-support', '/support-requests'],
  ['hq-audit', '/audit-logs'],
]);
await admin('kim.minsu@spoism.example', [
  ['ba-dashboard', '/'],
  ['ba-members', '/members'],
  ['ba-member-detail', null, (p) => p.locator('main table tbody tr').first().click()],
  ['ba-programs', '/programs'],
  ['ba-reservations', '/reservations'],
  ['ba-attendance', '/attendance'],
  ['ba-board', '/board'],
  ['ba-facilities', '/facilities'],
  ['ba-help', '/members', (p) => p.getByRole('button', { name: /도움말/ }).click()],
]);
await admin('park.seoyeon@spoism.example', [
  ['st-dashboard', '/'],
  ['st-attendance', '/attendance'],
]);

// 회원 웹 — 모바일 360px(디자인 기준 폭). 갱신 토큰을 localStorage에 둬 goto로 옮겨 다녀도 로그인이 유지된다(D41).
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 760 }, deviceScaleFactor: 2, isMobile: true, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/m/login`);
  await page.locator('input[type=email]').fill('lee.sujin@example.com');
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.endsWith('/login'));
  for (const [name, path] of [
    ['m-home', '/m/'],
    ['m-programs', '/m/programs'],
    ['m-reservations', '/m/reservations'],
    ['m-notices', '/m/notices'],
    ['m-me', '/m/me'],
  ]) {
    await page.goto(`${BASE}${path}`);
    await settle(page);
    await page.screenshot({ path: `${OUT}${name}.png` });
    console.log('찍음', name);
  }
  await ctx.close();
}
await browser.close();
stop();
