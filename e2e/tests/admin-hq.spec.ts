import { expect, test } from '@playwright/test';
import { ACCOUNTS, adminLogin, openMenu } from './helpers';

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
