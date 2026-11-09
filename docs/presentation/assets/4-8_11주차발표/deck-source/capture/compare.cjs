// 4-8 11주차 발표 — 변경 전·후 단계별 캡처(PT 세션 차감, 회차 등록). deck-source/README "변경 전·후 비교" 절차 참고.
// 변경 전 = bd1fd0f(log/198 기준선, D72·D73 이전) 앱, 변경 후 = 지금 dev 앱. 둘 다 seed:demo를 새로 얹은 DB, 서초점 김민수.
// 단계마다 누르기 직전(입력은 입력한 뒤) 화면을 찍고, 누를 대상에 테두리와 번호를 겹친다. 대상 위치는 meta.json에 남겨 crop-compare.py가 쓴다.
// 사용: node compare.cjs before|after <출력 폴더>   (PW_CHROMIUM_PATH로 브라우저 경로를 바꿀 수 있다)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const MODE = process.argv[2];
const OUT = path.resolve(process.argv[3] || 'screenshots/compare');
const ADMIN = 'http://localhost:5173';
const HIDE_DEV_TEXT = `.page-header .page-desc { display: none !important }`;
if (!['before', 'after'].includes(MODE)) throw new Error('before 또는 after');

const meta = {};
async function mark(page, locator, n) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await locator.evaluate((el, n) => {
    document.querySelectorAll('[data-step-mark]').forEach((e) => e.remove());
    const r = el.getBoundingClientRect();
    const ring = document.createElement('div');
    ring.setAttribute('data-step-mark', '');
    Object.assign(ring.style, { position: 'fixed', left: `${r.left - 6}px`, top: `${r.top - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px`,
      border: '4px solid #E0592A', borderRadius: '10px', zIndex: 99999, pointerEvents: 'none', boxSizing: 'border-box' });
    const badge = document.createElement('div');
    badge.setAttribute('data-step-mark', '');
    badge.textContent = String(n);
    Object.assign(badge.style, { position: 'fixed', left: `${Math.max(4, r.left - 22)}px`, top: `${Math.max(4, r.top - 22)}px`, width: '34px', height: '34px',
      borderRadius: '17px', background: '#E0592A', color: '#fff', font: '700 20px/34px sans-serif', textAlign: 'center', zIndex: 100000, pointerEvents: 'none' });
    document.body.append(ring, badge);
  }, n);
  return box;
}
async function shot(page, name, box, extra = {}) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.png`, ...extra });
  meta[name] = box;
  await page.evaluate(() => document.querySelectorAll('[data-step-mark]').forEach((e) => e.remove()));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(`${ADMIN}/login`);
  await page.locator('.demo-account-btn', { hasText: '김민수' }).click();
  await page.waitForURL((u) => !u.pathname.endsWith('/login'));
  await page.addStyleTag({ content: HIDE_DEV_TEXT });
  await page.waitForTimeout(1200);
  const navLink = (name) => page.locator('nav a').filter({ hasText: new RegExp(`^${name}\\d*$`) }).first(); // 메뉴 옆 건수 배지

  // ── PT 세션 차감 ──
  if (MODE === 'before') {
    let t = navLink('회원'); await shot(page, 'pt-before-1', await mark(page, t, 1)); await t.click();
    t = page.getByPlaceholder('이름 · 회원번호 · 전화번호'); await t.fill('이수진'); await shot(page, 'pt-before-2', await mark(page, t, 2));
    t = page.getByRole('button', { name: '검색' }); await shot(page, 'pt-before-3', await mark(page, t, 3)); await t.click();
    t = page.locator('main table tbody tr', { hasText: '이수진' }).first(); await t.waitFor(); await shot(page, 'pt-before-4', await mark(page, t, 4)); await t.click();
    t = page.getByRole('button', { name: 'PT 잔여세션' }); await t.waitFor(); await shot(page, 'pt-before-5', await mark(page, t, 5)); await t.click();
    t = page.getByRole('button', { name: '세션 사용' }).first(); await t.waitFor(); await shot(page, 'pt-before-6', await mark(page, t, 6));
  } else {
    let t = page.getByRole('combobox', { name: '회원 빠른 찾기' }); await t.fill('이수'); await page.getByRole('listbox').waitFor(); await shot(page, 'pt-after-1', await mark(page, t, 1));
    t = page.getByRole('option', { name: /이수진/ }).first(); await shot(page, 'pt-after-2', await mark(page, t, 2)); await t.click();
    t = page.getByRole('button', { name: '세션 사용' }).first(); await t.waitFor(); await shot(page, 'pt-after-3', await mark(page, t, 3));
  }

  // ── 회차 등록 ──
  await navLink('예약 관리').click();
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  if (MODE === 'before') {
    // 화면 전체(세로로 길게) — 폼이 첫 화면(900px) 아래에 있다
    const form = page.locator('form', { has: page.locator('label', { hasText: '정원(비우면' }) });
    const box = await form.boundingBox();
    const scrollY = await page.evaluate(() => window.scrollY);
    meta['slot-before-form'] = { ...box, y: box.y + scrollY };
    await page.screenshot({ path: `${OUT}/slot-before-full.png`, fullPage: true });
    meta['slot-before-full'] = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
  } else {
    const t = page.getByRole('button', { name: '+ 회차 등록' });
    await shot(page, 'slot-after-1', await mark(page, t, 1));
    await t.click();
    await page.getByRole('dialog').waitFor();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/slot-after-2.png` });
  }

  fs.writeFileSync(`${OUT}/meta-${MODE}.json`, JSON.stringify(meta, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
