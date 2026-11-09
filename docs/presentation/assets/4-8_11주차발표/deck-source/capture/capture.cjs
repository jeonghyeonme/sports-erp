// 4-8 11주차 발표 캡처(관리자 웹 4장 + 보조). 로컬 실행 화면에서 찍는다 — deck-source/README 절차 참고.
// 로그인은 화면의 데모 계정 버튼을 누른다(비밀번호를 입력하지 않는다). 머리말 아래 개발용 안내 문구는 숨긴다(4-0 §5).
// 사용: node capture.cjs <출력 폴더>   (PW_CHROMIUM_PATH로 브라우저 경로를 바꿀 수 있다)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.resolve(process.argv[2] || 'screenshots');
const ADMIN = 'http://localhost:5173';
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

// 내용 없는 시연용 PDF 한 쪽
function samplePdf(file) {
  const body = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n';
  fs.writeFileSync(file, body);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });

  // 지점 관리자(김민수, 서초점) — 빠른 찾기, 자산 목록, 문서함
  let page = await adminPage(browser, '김민수');
  await page.waitForTimeout(1200); // 첫 화면(대시보드) 위에서 펼친다
  await page.getByRole('combobox', { name: '회원 빠른 찾기' }).fill('이수');
  await page.getByRole('listbox').waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/ux-quick.png` });
  await page.keyboard.press('Escape');

  await menu(page, '자산');
  await page.getByRole('searchbox', { name: '자산 검색' }).waitFor();
  await page.locator('th', { hasText: '취득가액' }).locator('button').first().click();
  await page.waitForTimeout(400);
  await page.locator('th', { hasText: '취득가액' }).locator('button').first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/list-assets.png` });

  await menu(page, '문서');
  await page.getByRole('button', { name: '+ 문서 등록' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('select').first().selectOption('MANUAL');
  const pdf = path.join(require('os').tmpdir(), 'facility-safety-manual.pdf');
  samplePdf(pdf);
  await dialog.locator('input[type="file"]').setInputFiles(pdf);
  await dialog.locator('label', { hasText: '제목' }).locator('xpath=following-sibling::input').fill('시설 안전 점검 매뉴얼');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/doc-upload.png` });
  await dialog.getByRole('button', { name: '등록', exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/doc-box.png` });
  fs.rmSync(pdf);
  await page.close();

  // 본사(정하늘) — 대시보드 숫자 카드·월별 차트
  page = await adminPage(browser, '정하늘');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/chart-hq-top.png` });
  // 전사 운영 실적 제목을 화면 맨 위로(상단 바 아래)
  await page.getByText('전사 운영 실적', { exact: false }).first().evaluate((el) => {
    const top = el.getBoundingClientRect().top + window.scrollY - 90;
    (document.scrollingElement || document.documentElement).scrollTo(0, top);
    document.querySelectorAll('main, .main, .content').forEach((m) => m.scrollTo && m.scrollTo(0, m.scrollTop + el.getBoundingClientRect().top - 90));
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/chart-hq.png` });

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
