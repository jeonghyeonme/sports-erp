import { expect, test } from '@playwright/test';
import { ACCOUNTS, adminLogin, field, kstDate, openMenu } from './helpers';

// 직원(서초 박서연)과 지점 관리자(김민수)가 이어서 쓰는 근태 흐름 — 출근, 병가 신청 → 승인 → 병가 사용 일수(log/137).
test('직원 출근·병가 신청 → 지점 관리자 승인 → 직원 화면에 병가 사용 일수', async ({ browser }) => {
  const staff = await (await browser.newContext()).newPage();
  await adminLogin(staff, ACCOUNTS.seochoStaff);
  await openMenu(staff, '/attendance');
  await staff.getByRole('button', { name: '체크인' }).click();
  await expect(staff.getByRole('button', { name: '체크인' })).toBeDisabled();
  await expect(staff.getByRole('button', { name: '체크아웃' })).toBeEnabled();

  const leave = staff.locator('form', { hasText: '휴가 신청' });
  await leave.locator('select').first().selectOption('SICK');
  await field(staff, '시작일').fill(kstDate(7));
  await field(staff, '종료일').fill(kstDate(8));
  await leave.getByRole('button', { name: '휴가 신청' }).click();
  await expect(staff.getByText(/신청 완료 — 2일/)).toBeVisible();

  const admin = await (await browser.newContext()).newPage();
  await adminLogin(admin, ACCOUNTS.seochoAdmin);
  await openMenu(admin, '/attendance');
  const inbox = admin.locator('div', { has: admin.locator('h3', { hasText: '휴가 승인함' }) }).last();
  const row = inbox.locator('tr', { hasText: kstDate(7) });
  await row.getByRole('button', { name: '승인' }).click();
  await expect(row).toHaveCount(0);

  await openMenu(staff, '/');
  await openMenu(staff, '/attendance');
  await expect(staff.locator('.card', { hasText: '휴가 일수' }).locator('.stat-row', { hasText: '병가 사용' })).toContainText('2일');
});
