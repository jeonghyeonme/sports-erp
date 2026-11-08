import { expect, test } from '@playwright/test';
import { ACCOUNTS, adminLogin, field, kstDate } from '../tests/helpers';
import { Steps } from './recorder';

// 직원(서초 박서연) — 근태관리 화면의 셀프서비스.
const nav = (page: import('@playwright/test').Page, href: string) => page.locator(`nav a[href="${href}"]`).first();

test('S01 출근 체크인', async ({ page }, info) => {
  await adminLogin(page, ACCOUNTS.seochoStaff);
  const s = new Steps(page, 'S01', '직원', '출근 체크인');
  s.start();
  await s.click(nav(page, '/attendance'), '근태관리 메뉴');
  await s.click(page.getByRole('button', { name: '체크인' }), '체크인');
  await expect(page.getByRole('button', { name: '체크인' })).toBeDisabled();
  s.save(info);
});

test('S02 업무일지 작성', async ({ page }, info) => {
  await adminLogin(page, ACCOUNTS.seochoStaff);
  const s = new Steps(page, 'S02', '직원', '업무일지 작성');
  s.start();
  await s.click(nav(page, '/attendance'), '근태관리 메뉴');
  await s.fill(field(page, '내용'), '오전 PT 3건, 오후 시설 점검', '내용');
  await s.click(page.locator('form', { hasText: '내용' }).getByRole('button', { name: '저장' }), '저장');
  await expect(page.getByText('업무일지를 저장했습니다.')).toBeVisible();
  s.save(info);
});

test('S03 휴가 신청', async ({ page }, info) => {
  await adminLogin(page, ACCOUNTS.seochoStaff);
  const s = new Steps(page, 'S03', '직원', '휴가 신청');
  s.start();
  await s.click(nav(page, '/attendance'), '근태관리 메뉴');
  const leave = page.locator('form', { hasText: '휴가 신청' });
  await s.select(leave.locator('select').first(), 'ANNUAL', '유형');
  await s.fill(field(page, '시작일'), kstDate(30), '시작일');
  await s.fill(field(page, '종료일'), kstDate(30), '종료일');
  await s.click(leave.getByRole('button', { name: '휴가 신청' }), '휴가 신청');
  await expect(page.getByText(/신청 완료/)).toBeVisible();
  s.save(info);
});
