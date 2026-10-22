import { expect, test } from '@playwright/test';
import { ACCOUNTS, PASSWORD } from './helpers';

// D66 — 관리자 웹은 직원 계정만 받는다. 회원 계정은 로그인 화면에 머물며 회원 앱으로 안내받고, 데모 버튼에도 회원이 없다.
test('관리자 웹: 회원 계정은 로그인되지 않고 회원 앱으로 안내한다', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('.demo-account-btn')).toHaveCount(4);
  await expect(page.locator('.demo-account-btn', { hasText: '이수진' })).toHaveCount(0);

  await page.locator('input[type=email]').fill(ACCOUNTS.seochoMember);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();

  await expect(page.locator('.error-text')).toContainText('회원 계정은 관리자 웹에서 쓸 수 없습니다');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('link', { name: /회원 앱에서 로그인/ })).toHaveAttribute('href', '/m/');
});
