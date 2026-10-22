import { expect, test } from '@playwright/test';
import { ACCOUNTS, apiAs, field } from './helpers';

// 보안-6(log/164) — 본사가 채용한 직원은 무작위 임시 비밀번호로 시작하고, 첫 로그인에서 업무 화면 대신
// "임시 비밀번호 변경" 창만 본다. 바꾸면 다시 로그인하고, 새 비밀번호로는 대시보드가 열린다.
test('채용된 직원: 첫 로그인에서 임시 비밀번호를 바꿔야 업무 화면이 열린다', async ({ page }) => {
  const email = `first.${Date.now()}@spoism.example`;
  const hq = await apiAs(ACCOUNTS.hq);
  const hire = await hq.post('staff', { data: { branchId: 'branch-seocho', name: '첫출근', email } });
  expect(hire.status()).toBe(201);
  const temp = (await hire.json()).data.temporaryPassword as string;
  await hq.dispose();

  const loginWith = async (password: string) => {
    await page.goto('/login');
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill(password);
    await page.locator('button[type=submit]').click();
  };

  await loginWith(temp);
  const modal = page.locator('.modal-card', { hasText: '임시 비밀번호 변경' });
  await expect(modal).toBeVisible();
  await expect(page.locator('aside.sidebar')).toHaveCount(0); // 메뉴(업무 화면)는 그리지 않는다

  // 규칙 위반은 화면에서 먼저 막는다
  await field(page, '현재 비밀번호').fill(temp);
  await field(page, '새 비밀번호 *').fill('onlyletters');
  await field(page, '새 비밀번호 확인').fill('onlyletters');
  await modal.locator('button[type=submit]').click();
  await expect(modal).toContainText('영문과 숫자');

  const next = 'first-day-2026';
  await field(page, '새 비밀번호 *').fill(next);
  await field(page, '새 비밀번호 확인').fill(next);
  await modal.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/\/login$/);

  await loginWith(next);
  await expect(page).not.toHaveURL(/\/login$/);
  await expect(page.locator('aside.sidebar nav')).toBeVisible();
  await expect(page.locator('.modal-card', { hasText: '임시 비밀번호 변경' })).toHaveCount(0);
});
