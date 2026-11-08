import { expect, test } from '@playwright/test';
import { ACCOUNTS, adminLogin, field, kstDate } from '../tests/helpers';
import { Steps } from './recorder';

// 본사(정하늘) — 대시보드에서 시작.
const nav = (page: import('@playwright/test').Page, href: string) => page.locator(`nav a[href="${href}"]`).first();
const PDF = { name: '계약서.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 steps') };

test('H01 지점 운영 실적 보기', async ({ page }, info) => {
  await adminLogin(page, ACCOUNTS.hq);
  const s = new Steps(page, 'H01', '본사', '지점 운영 실적 보기');
  s.start();
  await s.click(page.getByText('서초점').first(), '지점 행');
  await expect(page.getByText('운영 실적').first()).toBeVisible();
  s.save(info);
});

test('H02 갱신 임박 지점 계약 갱신', async ({ page }, info) => {
  await adminLogin(page, ACCOUNTS.hq);
  const s = new Steps(page, 'H02', '본사', '갱신 임박 지점 계약 갱신');
  s.start();
  await s.click(page.getByText('계약 갱신 임박 지점'), '갱신 임박 알림 카드');
  await s.click(page.locator('main tr', { hasText: '마포점' }).first(), '지점 행');
  await s.click(page.getByRole('button', { name: '계약 갱신' }), '계약 갱신');
  await s.upload(field(page, '새 계약서'), PDF, '새 계약서');
  await s.fill(field(page, '새 회차 시작일'), kstDate(400), '시작일');
  await s.fill(field(page, '새 회차 종료일'), kstDate(1100), '종료일');
  await s.click(page.getByRole('button', { name: '갱신', exact: true }), '갱신');
  await expect(page.getByText(/회차\(.*\)로 갱신했습니다/)).toBeVisible();
  s.save(info);
});

test('H03 직원 채용', async ({ page }, info) => {
  await adminLogin(page, ACCOUNTS.hq);
  const s = new Steps(page, 'H03', '본사', '직원 채용');
  s.start();
  await s.click(nav(page, '/staff'), '직원 메뉴');
  await s.click(page.getByRole('button', { name: '+ 직원 채용' }), '+ 직원 채용');
  await s.select(field(page, '파견 지점 *'), { label: '서초점' }, '파견 지점');
  await s.fill(field(page, '이름 *'), '측정직원', '이름');
  await s.fill(field(page, '이메일(로그인 ID) *'), `steps${Date.now() % 100000}@spoism.example`, '이메일');
  await s.click(page.getByRole('button', { name: '채용', exact: true }), '채용');
  await expect(page).toHaveURL(/\/staff\/[^/]+$/);
  s.save(info);
});

test('H04 직원 파견 발령', async ({ page }, info) => {
  await adminLogin(page, ACCOUNTS.hq);
  const s = new Steps(page, 'H04', '본사', '직원 파견 발령');
  s.start();
  await s.click(nav(page, '/staff'), '직원 메뉴');
  await s.fill(page.getByPlaceholder('이름·직원코드·지점명 검색'), '최강남', '검색어');
  await s.click(page.locator('main tr', { hasText: '최강남' }).first(), '직원 행');
  await s.click(page.getByRole('button', { name: '파견 발령' }), '파견 발령');
  await s.select(field(page, '새 파견 지점 *'), { label: '서초점' }, '새 파견 지점');
  await s.click(page.getByRole('button', { name: '발령', exact: true }), '발령');
  await expect(page.locator('.modal-card')).toHaveCount(0);
  s.save(info);
});
