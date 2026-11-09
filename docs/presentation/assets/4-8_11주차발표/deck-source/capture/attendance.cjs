// 4-8 11주차 발표 — 화면 안 순서(D73) 예시: 지점 관리자 근태관리 화면 전체를 변경 전·후로 찍고, 구역 제목 위치를 남긴다.
// 변경 전 = bd1fd0f 앱, 변경 후 = 지금 앱(README "변경 전·후 비교" 절차와 같은 서버 교체). 로그인은 데모 계정 버튼.
// 사용: node attendance.cjs before|after <출력 폴더>
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const MODE = process.argv[2];
const OUT = path.resolve(process.argv[3] || 'screenshots/compare');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:5173/login');
  await page.locator('.demo-account-btn', { hasText: '김민수' }).click();
  await page.waitForURL((u) => !u.pathname.endsWith('/login'));
  await page.addStyleTag({ content: '.page-header .page-desc { display: none !important }' });
  await page.locator('nav a').filter({ hasText: /^근태관리\d*$/ }).first().click();
  await page.locator('h3', { hasText: '휴가 승인함' }).waitFor();
  await page.waitForTimeout(1500);
  const sections = await page.locator('main h3').evaluateAll((hs) =>
    hs.map((h) => { const r = h.getBoundingClientRect(); return { text: h.textContent.trim(), x: r.left, y: r.top + window.scrollY, h: r.height }; }),
  );
  const size = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
  await page.screenshot({ path: `${OUT}/attendance-${MODE}.png`, fullPage: true });
  fs.writeFileSync(`${OUT}/attendance-${MODE}.json`, JSON.stringify({ size, sections }, null, 2));
  console.log(MODE, size, sections.map((s) => `${Math.round(s.y)} ${s.text}`).join(' | '));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
