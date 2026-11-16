import { expect, Page, test } from '@playwright/test';
import { ACCOUNTS, adminLogin, openMenu } from './helpers';

// 900px 이하 폭(log/197 B-2·log/201 "검증되지 않음") — 관리자 웹은 데스크톱 기준이지만, 좁은 노트북·창 분할에서도
// 본문이 가로로 넘치지 않아야 한다. 카드는 최소 폭으로 줄바꿈하고(card-grid), 모달은 화면 안에 들어와야 한다.
test.use({ viewport: { width: 800, height: 900 } });

/** 본문(main)이 가로로 넘치지 않는다 — 표처럼 의도한 가로 스크롤은 그 요소 안에서만. */
async function expectNoHorizontalOverflow(page: Page) {
  // 목록이 그려진 뒤에 잰다 — "불러오는 중"일 때 재면 표가 아직 없어 넘침을 놓친다(실제로 결과가 실행마다 달랐다).
  await expect(page.locator('main .loading-state')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const main = document.querySelector('main');
    // 넘칠 때 원인을 보이게 — main 오른쪽 끝을 넘는 요소 몇 개(태그.클래스)
    const right = main ? main.getBoundingClientRect().right : doc.clientWidth;
    const culprits = [...(main?.querySelectorAll('*') ?? [])]
      .filter((el) => el.getBoundingClientRect().right > right + 1)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}(${Math.round(el.getBoundingClientRect().width)}px)`);
    return { page: doc.scrollWidth - doc.clientWidth, main: main ? main.scrollWidth - main.clientWidth : 0, at: location.pathname, culprits };
  });
  expect(overflow.page, '페이지 가로 넘침(px)').toBeLessThanOrEqual(1);
  expect(overflow.main, `본문 가로 넘침(px) ${overflow.at} ${overflow.culprits.join(', ')}`).toBeLessThanOrEqual(1);
}

/** selector 안의 글자 중 두 줄 이상으로 꺾인 것 — 짧은 라벨(버튼·상태 표시)은 한 줄이어야 읽힌다. */
async function wrappedTexts(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const wrapped: string[] = [];
    for (const root of document.querySelectorAll(sel)) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = n.textContent?.trim();
        if (!text) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        const tops = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)));
        if (tops.size > 1) wrapped.push(text);
      }
    }
    return [...new Set(wrapped)];
  }, selector);
}

/**
 * 상단 바와 표 안의 상태 표시·버튼이 한 줄로 들어온다 — 본문 넘침 검사만으로는 못 잡았다
 * (12주차 덱 캡처에서 눈으로 발견, log/233).
 */
async function expectLabelsOneLine(page: Page) {
  expect(await wrappedTexts(page, 'header.topbar'), '상단 바에서 줄바꿈된 글자').toEqual([]);
  const overflow = await page.evaluate(() => {
    const bar = document.querySelector('header.topbar');
    return bar ? bar.scrollWidth - bar.clientWidth : 0;
  });
  expect(overflow, '상단 바 가로 넘침(px)').toBeLessThanOrEqual(1);
  expect(await wrappedTexts(page, 'main td .badge, main td button'), `표 안에서 줄바꿈된 라벨 ${page.url()}`).toEqual([]);
}

test('800px 폭: 지점 관리자 주요 화면이 가로로 넘치지 않고 회차 등록 창이 화면 안에 들어온다', async ({ page }) => {
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  await expect(page.locator('main h2').first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectLabelsOneLine(page);

  for (const href of ['/attendance', '/members', '/programs', '/instructors', '/staff', '/board', '/facilities', '/assets', '/documents', '/support-requests', '/reservations']) {
    await openMenu(page, href);
    await expect(page.locator('main h2').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expectNoHorizontalOverflow(page);
  await expectLabelsOneLine(page);
    await expectLabelsOneLine(page);
  }

  await page.getByRole('button', { name: '+ 회차 등록' }).click();
  const box = await page.getByRole('dialog').boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(800);
});

test('800px 폭: 본사 화면(대시보드·지점 상세·권한·변경 이력·계약 파일 보존)이 가로로 넘치지 않는다', async ({ page }) => {
  await adminLogin(page, ACCOUNTS.hq);
  await expect(page.locator('main h2').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expectNoHorizontalOverflow(page);
  await expectLabelsOneLine(page);
  await page.getByText('서초점').first().click();
  await expect(page).toHaveURL(/\/branches\//);
  await page.waitForLoadState('networkidle');
  await expectNoHorizontalOverflow(page);
  await expectLabelsOneLine(page);
  for (const href of ['/staff', '/permissions', '/audit-logs', '/contract-retention', '/support-requests']) {
    await openMenu(page, href);
    await expect(page.locator('main h2').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expectNoHorizontalOverflow(page);
  await expectLabelsOneLine(page);
    await expectLabelsOneLine(page);
  }
});
