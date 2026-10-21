import { expect, test } from '@playwright/test';
import { ACCOUNTS, adminLogin, apiAs } from './helpers';

// D61 — 처리 대기함·배지. 직원이 휴가를 신청하면 지점 관리자 대시보드 첫 카드에 "승인 대기 휴가"가 뜨고, 누르면 근태관리로 간다.
// 메뉴 옆 배지는 승인하면 바로 준다.
test('지점 관리자: 대시보드 처리 대기에서 승인 대기 휴가로 바로 간다', async ({ page }) => {
  const staff = await apiAs(ACCOUNTS.seochoStaff);
  const res = await staff.post('leave-requests', { data: { type: 'ANNUAL', startDate: '2026-12-07', endDate: '2026-12-07' } });
  expect(res.status()).toBe(201);
  await staff.dispose();

  await adminLogin(page, ACCOUNTS.seochoAdmin);
  const inbox = page.locator('.inbox-card');
  await expect(inbox).toContainText('처리 대기');
  const leave = inbox.getByRole('link', { name: /승인 대기 휴가/ });
  await expect(leave).toBeVisible();
  await leave.click();
  await expect(page).toHaveURL(/\/attendance$/);

  // 배지 — 근태관리 메뉴 옆 숫자와 상단 "처리 대기" 합계. 승인하면(쓰기 성공 → 대기함 다시 받음) 메뉴 배지가 1 준다.
  const navBadge = page.locator('nav a[href="/attendance"] .nav-badge');
  await expect(navBadge).toBeVisible();
  await expect(page.locator('.inbox-pill')).toBeVisible();
  const before = Number(await navBadge.innerText());
  const approvals = page.locator('div', { has: page.locator('h3', { hasText: '휴가 승인함' }) }).last();
  await approvals.locator('tr', { hasText: '2026-12-07' }).getByRole('button', { name: '승인' }).click();
  if (before > 1) await expect(navBadge).toHaveText(String(before - 1));
  else await expect(navBadge).toHaveCount(0);
});
