import { expect, test } from '@playwright/test';
import { ACCOUNTS, adminLogin, apiAs } from './helpers';

// D61 — 처리 대기함. 직원이 휴가를 신청하면 지점 관리자 대시보드 첫 카드에 "승인 대기 휴가"가 뜨고, 누르면 근태관리로 간다.
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
});
