// RFP 이행 증빙서(rfp-evidence.js)에 넣을 조항별 화면 캡처 — 파일 이름이 조항 ID다(F1-2.png 등).
//   npm run build --workspace=apps/api && npm run build:web
//   PW_CHROMIUM_PATH=... node scripts/deliverables/capture-rfp.mjs   → scripts/deliverables/figs/rfp/*.png
// capture-manual.mjs와 같은 구조 — 화면 테스트 전용 DB(sports_erp_e2e, D59)를 비우고 기준 시드 + 시연 데이터 층(D58)을
// 넣은 뒤, 빌드한 api·웹을 화면 테스트와 같은 구조(e2e/serve.mjs)로 띄워 찍는다. 배포 환경과 개발 DB에는 닿지 않는다.
// 관리자 화면은 머리말 아래 개발용 안내 문구를 숨긴다(4-0 §5). 조작은 화면을 여는 데까지만 — 저장 버튼은 누르지 않는다.
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = new URL('../..', import.meta.url).pathname;
const OUT = new URL('./figs/rfp/', import.meta.url).pathname;
const DB = process.env.E2E_DATABASE_URL ?? 'postgresql://sports_erp:change-me-in-local-env@localhost:5432/sports_erp_e2e?schema=public';
const API_PORT = 3102;
const WEB_PORT = 4302;
const BASE = `http://localhost:${WEB_PORT}`;
const env = { ...process.env, DATABASE_URL: DB, DIRECT_URL: DB };

mkdirSync(OUT, { recursive: true });
execSync('node e2e/reset-db.mjs', { cwd: ROOT, env, stdio: 'inherit' });
execSync('npx ts-node prisma/seed-demo.ts', { cwd: `${ROOT}apps/api`, env, stdio: 'inherit' });
// 시연 층의 현장 인원 입력 시각은 시연 기간 끝 18시라 찍는 시각에 따라 "N일 전"이 된다 — 운영 중인 시설은 방금 입력한 상태로 둔다(캡처 전용 DB).
execSync(`psql "${DB.replace('?schema=public', '')}" -c "UPDATE \\"Facility\\" SET \\"lastUpdatedAt\\" = now() - interval '8 minutes' WHERE \\"isActive\\""`, { stdio: 'inherit' });

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
const HIDE_DEV_TEXT = '.page-header .page-desc { display: none !important }';
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});

// 관리자 웹은 토큰을 메모리에만 둔다 — 새로고침 대신 앱 안에서 경로를 바꾼다.
const go = (page, path) =>
  page.evaluate((p) => {
    history.pushState({}, '', p);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);
const settle = (page) => page.waitForLoadState('networkidle').then(() => page.waitForTimeout(500));
const scrollTo = (text) => (page) => page.getByText(text, { exact: false }).first().scrollIntoViewIfNeeded();

async function admin(email, shots) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.endsWith('/login'));
  await page.addStyleTag({ content: HIDE_DEV_TEXT });
  for (const [name, path, prepare] of shots) {
    if (path) await go(page, path);
    await settle(page);
    if (prepare) await prepare(page);
    await settle(page);
    await page.screenshot({ path: `${OUT}${name}.png` });
    console.log('찍음', name);
    // 모달을 연 장면 다음에는 닫는다(저장하지 않음)
    const close = page.getByRole('button', { name: '닫기' });
    if (await close.count()) await close.first().click();
  }
  await ctx.close();
}

// 회원 웹(이수진, 서초점) — 휴대폰 크기. 갱신 토큰이 localStorage에 있어 goto로 옮겨 다녀도 로그인이 유지된다(D41).
async function member(email, shots) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/m/login`);
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await page.waitForURL((u) => !u.pathname.endsWith('/login'));
  for (const [name, path, prepare] of shots) {
    await page.goto(`${BASE}${path}`);
    await settle(page);
    if (prepare) await prepare(page);
    await settle(page);
    await page.screenshot({ path: `${OUT}${name}.png` });
    console.log('찍음', name);
  }
  await ctx.close();
}

// 로그인 실패 — 오류 문구 아래 "해결" 한 줄(N4-2)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.locator('input[type=email]').fill('kim.minsu@spoism.example');
  await page.locator('input[type=password]').fill('wrong-password-0');
  await page.locator('button[type=submit]').click();
  await page.locator('.error-text').first().waitFor();
  await page.screenshot({ path: `${OUT}N4-2.png` });
  console.log('찍음', 'N4-2');
  await ctx.close();
}

// 본사(정하늘)
await admin('jeong.haneul@spoism.example', [
  ['N6-2', '/'],
  ['N4-1', '/', (p) => p.locator('.help-btn').click()],
  ['N6-3', '/branches/branch-seocho'],
  ['N5-1', '/branches/branch-seocho', (p) => p.getByRole('button', { name: '계약 상태 변경' }).first().click()],
  ['N3-1', '/audit-logs'],
  ['C1', '/support-requests'],
  ['F1-1', '/permissions'],
  ['F1-2', '/permissions', (p) => p.getByRole('button', { name: '역할 기본 권한' }).click()],
  ['F2-1', '/staff', (p) => p.getByText('서초점', { exact: true }).first().click()],
  ['F2-2', '/staff/staff-seoyeon'],
  ['F4-2', '/board', (p) => p.getByRole('button', { name: '직원 교육자료' }).click()],
]);
// 지점 관리자(김민수, 서초점)
await admin('kim.minsu@spoism.example', [
  ['F1-3', '/'],
  ['F1-5', '/staff/staff-seoyeon', (p) => p.getByRole('button', { name: '퇴사 처리' }).first().click()],
  ['F2-3', '/staff', scrollTo('변경 신청')],
  ['F3-1', '/attendance'],
  ['F3-3', '/staff/staff-seoyeon', scrollTo('업무일지')],
  ['F4-1', '/board'],
  ['F4-3', '/board/new'],
  ['F5-1', '/members/member-sujin'],
  ['F5-2', '/members'],
  ['F7-1', '/instructors'],
  ['F7-2', '/programs'],
  ['F8-2', '/facilities'],
  ['N6-6', '/reservations', scrollTo('주간 시간표')],
]);
// 직원(박서연)
await admin('park.seoyeon@spoism.example', [['F3-2', '/attendance']]);
await member('lee.sujin@example.com', [
  ['F8-1', '/m/'],
  ['F6-1', '/m/reservations'],
  ['T4-1', '/m/guide'],
  ['N8-2', '/m/privacy', scrollTo('위탁')],
]);

await browser.close();
stop();
