import { expect, Page, test } from '@playwright/test';
import { ACCOUNTS, adminLogin, apiAs, openMenu } from './helpers';

// D74 2차 — 쌓이는 목록은 서버가 검색·정렬한다(log/204·205). 자산·업무지원은 화면 자동 테스트가 없던 곳(log/197 D-5).

/** 표의 한 열 글자들(머리글 이름으로 열 위치를 찾는다). */
async function column(page: Page, header: string): Promise<string[]> {
  const heads = await page.locator('main table thead th').allInnerTexts();
  const idx = heads.findIndex((h) => h.replace(/[▲▼↕]/g, '').trim() === header);
  expect(idx, `열 "${header}" 없음: ${heads.join(' | ')}`).toBeGreaterThanOrEqual(0);
  return page.locator(`main table tbody tr td:nth-child(${idx + 1})`).allInnerTexts();
}
const won = (s: string) => Number(s.replace(/[^0-9]/g, ''));

test('지점 관리자: 자산을 검색하고 취득가액 머리글로 오름·내림 정렬한다', async ({ page }) => {
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  await openMenu(page, '/assets');
  await expect(page.locator('main table tbody tr').first()).toBeVisible();

  const sortBtn = page.locator('main table thead').getByRole('button', { name: /취득가액/ });
  await sortBtn.click();
  await expect(page.locator('main table thead th', { hasText: '취득가액' })).toHaveAttribute('aria-sort', 'ascending');
  await expect.poll(async () => (await column(page, '취득가액')).map(won)).toEqual(
    [...(await column(page, '취득가액')).map(won)].sort((a, b) => a - b),
  );
  const asc = (await column(page, '취득가액')).map(won);
  expect(asc.length).toBeGreaterThan(1);

  await sortBtn.click();
  await expect(page.locator('main table thead th', { hasText: '취득가액' })).toHaveAttribute('aria-sort', 'descending');
  await expect.poll(async () => (await column(page, '취득가액')).map(won)).toEqual([...asc].sort((a, b) => b - a));

  // 검색 — 첫 줄의 품명으로 찾으면 그 품명을 가진 줄만 남는다
  const name = (await column(page, '품명'))[0];
  await page.getByRole('searchbox', { name: '자산 검색' }).fill(name);
  await expect.poll(async () => (await column(page, '품명')).every((n) => n.includes(name))).toBe(true);
  await page.getByRole('searchbox', { name: '자산 검색' }).fill('없는-자산-이름-xyz');
  await expect(page.locator('main table tbody tr')).toHaveCount(0);
});

test('본사: 업무지원 요청을 검색하고 제목 머리글로 정렬한다', async ({ page }) => {
  const tag = `정렬검사${Date.now() % 100000}`;
  const minsu = await apiAs(ACCOUNTS.seochoAdmin);
  for (const t of ['나 요청', '가 요청', '다 요청']) {
    expect((await minsu.post('support-requests', { data: { category: 'FACILITY', title: `${tag} ${t}`, content: '화면 테스트용 요청입니다.' } })).status()).toBe(201);
  }
  await minsu.dispose();

  await adminLogin(page, ACCOUNTS.hq);
  await openMenu(page, '/support-requests');
  // 본사 기본 필터는 "요청"이라 새 요청이 보인다. 검색으로 이 테스트 것만 남긴다.
  await page.getByRole('searchbox', { name: '업무지원 요청 검색' }).fill(tag);
  await expect(page.locator('main table tbody tr')).toHaveCount(3);

  const sortBtn = page.locator('main table thead').getByRole('button', { name: /제목/ });
  await sortBtn.click();
  await expect.poll(() => column(page, '제목')).toEqual([`${tag} 가 요청`, `${tag} 나 요청`, `${tag} 다 요청`]);
  await sortBtn.click();
  await expect.poll(() => column(page, '제목')).toEqual([`${tag} 다 요청`, `${tag} 나 요청`, `${tag} 가 요청`]);
});
