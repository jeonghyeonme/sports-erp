import { expect, test } from '@playwright/test';
import { ACCOUNTS, adminLogin, field, kstDate, openMenu } from './helpers';

// 본사 관리자 — 대시보드(지점 10곳 이하면 지역 그룹이 펼쳐짐, log/130) → 지점 상세(운영 실적 3개월, log/129) → 변경 이력.
test('본사: 대시보드에서 지점 상세의 운영 실적과 변경 이력을 본다', async ({ page }) => {
  await adminLogin(page, ACCOUNTS.hq);
  await expect(page.getByText('서초점').first()).toBeVisible();
  await page.getByText('서초점').first().click();
  await expect(page).toHaveURL(/\/branches\//);
  await expect(page.getByText('운영 실적').first()).toBeVisible();
  await expect(page.getByText('매출').first()).toBeVisible();

  await openMenu(page, '/audit-logs');
  await expect(page.locator('main h2', { hasText: '변경 이력' })).toBeVisible();
  // 기준 시드에는 이력이 없을 수 있다 — 표나 빈 상태 중 하나가 그려지면(오류 없이) 통과.
  await expect(page.locator('main table, main .empty-state').first()).toBeVisible();
});

// D68 — 본사가 지점 상세에서 계약을 갱신하면 기간·상태가 바뀌고, 같은 화면의 계약 이력과 변경 이력 화면에 남는다.
test('본사: 지점 상세에서 계약을 갱신하고 계약 이력으로 확인한다', async ({ page }) => {
  const newEnd = kstDate(1200);
  await adminLogin(page, ACCOUNTS.hq);
  await page.getByText('서초점').first().click();
  await expect(page).toHaveURL(/\/branches\//);
  await page.getByRole('button', { name: '계약 갱신' }).click();
  await field(page, '새 종료일').fill(newEnd);
  await page.getByRole('button', { name: '갱신', exact: true }).click();
  await expect(page.getByText(`${newEnd}까지 갱신했습니다.`)).toBeVisible();

  const card = page.locator('.detail-section', { hasText: '계약 정보' });
  await expect(card).toContainText(`~ ${newEnd}`);
  await expect(card.locator('table')).toContainText('계약 갱신');
  await expect(card.locator('table')).toContainText(`→ ${newEnd}`);

  await openMenu(page, '/audit-logs');
  await expect(page.locator('main table')).toContainText('지점 서초점');
});

// D68 결정 5 — 새 위탁계약 = 새 지점. 등록하면 상세로 옮겨 가고, 계약 이력 첫 줄이 "지점 등록"이다.
test('본사: 대시보드에서 새 지점을 등록하면 지점 상세로 간다', async ({ page }) => {
  await adminLogin(page, ACCOUNTS.hq);
  await page.getByRole('button', { name: '+ 지점 등록' }).click();
  await field(page, '지점명').fill('판교점');
  await field(page, '지점 코드').fill('pangyo'); // 소문자로 쳐도 대문자로 바뀐다
  await field(page, '지역').fill('경기');
  await field(page, '계약 상대방').fill('판교 OO오피스텔 관리단');
  await field(page, '계약 시작일').fill(kstDate(0));
  await field(page, '계약 종료일').fill(kstDate(730));
  await page.getByRole('button', { name: '등록', exact: true }).click();

  await expect(page).toHaveURL(/\/branches\//);
  await expect(page.locator('main h2', { hasText: '판교점' })).toBeVisible();
  const card = page.locator('.detail-section', { hasText: '계약 정보' });
  await expect(card).toContainText('판교 OO오피스텔 관리단');
  await expect(card.locator('table')).toContainText('지점 등록');
  await expect(card.locator('table')).toContainText('코드 PANGYO');
});
