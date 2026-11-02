// 8주차 캡처 1장 — 마포점(갱신 임박) 지점 상세의 계약 정보·계약 회차. 로컬 실행 화면(api + admin-web, seed:demo 직후 DB).
// 실제 API 조작으로 상태를 만든다: 1회차에 계약서 올리기 → 새 계약서로 계약 갱신(2회차). 로그인은 데모 계정 버튼(비밀번호 입력 없음).
// 사용: node capture.cjs <출력 폴더>   (PW_CHROMIUM_PATH로 브라우저 경로를 바꿀 수 있다)
const { chromium } = require('@playwright/test');

const OUT = process.argv[2] || 'screenshots';
const ADMIN = 'http://localhost:5173';
const pdf = (name) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 sample') });
const field = (page, label) => page.locator('.field', { has: page.locator('label', { hasText: label }) }).locator('input');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(`${ADMIN}/login`);
  await page.locator('.demo-account-btn', { hasText: '정하늘' }).click();
  await page.waitForURL((u) => !u.pathname.endsWith('/login'));
  await page.getByText('마포점').first().click();
  await page.waitForURL(/\/branches\//);
  const card = page.locator('.detail-section', { hasText: '계약 정보' });
  await card.waitFor();

  // 1회차 계약서(시연 데이터는 "계약서 미등록"으로 시작한다)
  await page.getByRole('button', { name: '계약서 올리기' }).click();
  await page.locator('.modal input[type=file], input[type=file]').first().setInputFiles(pdf('마포점_위탁운영계약서_1회차.pdf'));
  await page.getByRole('button', { name: '올리기', exact: true }).click();
  await page.getByText('1회차에 계약서를 올렸습니다').waitFor();

  // 새 계약서로 갱신 → 2회차
  await page.getByRole('button', { name: '계약 갱신' }).click();
  await field(page, '새 계약서').setInputFiles(pdf('마포점_위탁운영계약서_2회차.pdf'));
  await field(page, '새 회차 시작일').fill('2026-12-08');
  await field(page, '새 회차 종료일').fill('2028-12-07');
  await page.getByRole('button', { name: '갱신', exact: true }).click();
  await page.getByText('2회차(2026-12-08 ~ 2028-12-07)로 갱신했습니다.').waitFor();
  await page.waitForTimeout(4500); // 알림 토스트가 사라질 때까지

  await page.addStyleTag({ content: '.page-desc { display: none !important }' });
  await page.waitForTimeout(500);
  await card.screenshot({ path: `${OUT}/c-rounds.png` });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
