// 4-7 중간발표 캡처(관리자 웹 4장 + 회원 웹 1장). 로컬 실행 화면에서 찍는다 — README 절차 참고.
// 로그인은 화면의 데모 계정 버튼을 누른다(비밀번호를 입력하지 않는다). 관리자 화면은 머리말 아래 개발용 안내 문구를 숨긴다(4-0 §5).
// 사용: node capture.cjs <출력 폴더>   (PW_CHROMIUM_PATH로 브라우저 경로를 바꿀 수 있다)
const { chromium, devices } = require('@playwright/test');

const OUT = process.argv[2] || 'screenshots';
const ADMIN = 'http://localhost:5173';
const MEMBER = 'http://localhost:5174/m';
const HIDE_DEV_TEXT = `.page-header .page-desc { display: none !important }`;

async function adminPage(browser, who) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(`${ADMIN}/login`);
  await page.locator('.demo-account-btn', { hasText: who }).click();
  await page.waitForURL((u) => !u.pathname.endsWith('/login'));
  await page.addStyleTag({ content: HIDE_DEV_TEXT });
  await page.waitForTimeout(800);
  return page;
}

const menu = (page, name) => page.locator('nav a', { hasText: name }).first().click();

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });

  // 본사(정하늘) — 업무지원 요청 처리 창, 마포 운영 실적, 역할 기본 권한
  let page = await adminPage(browser, '정하늘');
  await menu(page, '업무지원 요청');
  await page.locator('tr', { hasText: '강남점' }).first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/after-support.png` });
  await page.getByRole('button', { name: '닫기' }).click();

  await menu(page, '대시보드');
  await page.locator('tr', { hasText: '마포점' }).first().click();
  await page.locator('h3', { hasText: '운영 실적' }).waitFor();
  // 계약 정보 아래 OCR 설계 안내는 개발용 문구다.
  await page.evaluate(() => document.querySelectorAll('p').forEach((p) => { if (p.textContent.includes('OCR')) p.style.display = 'none'; }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/after-qa.png` });

  await menu(page, '권한 관리');
  await page.getByRole('button', { name: '역할 기본 권한' }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/after-permission.png` });
  await page.close();

  // 지점 관리자(김민수) — 회원 상세(상단 경로 표시)
  page = await adminPage(browser, '김민수');
  await menu(page, '회원');
  await page.getByPlaceholder(/이름/).first().fill('이수진');
  await page.getByRole('button', { name: '검색' }).click();
  await page.locator('tr', { hasText: '이수진' }).first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/ov-scope-admin.png` });
  await page.close();

  // 회원(이수진) — 회원 모바일 웹 예약 → 모의 결제(iPhone 13 에뮬레이션, 실기기 아님)
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const m = await ctx.newPage();
  await m.goto(`${MEMBER}/login`);
  await m.locator('.demo-login button').click();
  await m.waitForURL((u) => !u.pathname.endsWith('/login'));
  await m.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '예약하기' }).click();
  await m.getByText('저녁 필라테스').first().click();
  await m.getByText('19:30').first().click();
  await m.waitForTimeout(800);
  await m.screenshot({ path: `${OUT}/ov-scope-member-1-slot.png` });
  await m.getByRole('button', { name: /예약/ }).first().click();
  await m.waitForTimeout(1000);
  await m.screenshot({ path: `${OUT}/ov-scope-member-2-pay.png` });
  await m.getByRole('button', { name: /결제/ }).first().click();
  await m.getByText('예약이 확정됐습니다.').waitFor();
  await m.waitForTimeout(600);
  await m.screenshot({ path: `${OUT}/ov-scope-member-3-done.png` });

  await browser.close();
})();
