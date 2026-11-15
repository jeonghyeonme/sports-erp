import { expect, test } from '@playwright/test';
import { ACCOUNTS, adminLogin, field, openMenu } from './helpers';

// 인사정보관리 불변규칙 1·ADR-STF-01 — 채용(= 최초 파견)과 파견 발령은 본사만 화면에서 한다(log/197 D-5 "인사 화면" 공백).
test('본사: 직원을 채용하면 상세로 가고, 다른 지점으로 파견 발령한다', async ({ page }) => {
  const email = `e2e-hire-${Date.now() % 100000}@spoism.example`;
  await adminLogin(page, ACCOUNTS.hq);
  await openMenu(page, '/staff');
  await page.getByRole('button', { name: '+ 직원 채용' }).click();
  const dialog = page.getByRole('dialog', { name: '직원 채용' });
  await field(page, '파견 지점 *').selectOption({ label: '서초점' });
  await field(page, '이름 *').fill('화면채용');
  await field(page, '이메일(로그인 ID) *').fill(email);
  await dialog.getByRole('button', { name: '채용', exact: true }).click();

  // 임시 비밀번호는 채용 직후 알림에만 보인다(보안-6) — 직원 코드와 함께 뜨고, 화면은 새 직원 상세로 옮겨 간다.
  await expect(page.getByText(/화면채용님을 서초점에 채용했습니다\(SEOCHO-\d+\)/)).toBeVisible();
  await expect(page.getByText('임시 비밀번호', { exact: false }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/staff\/[^/]+$/);
  await expect(page.locator('main h2', { hasText: '화면채용' })).toBeVisible();

  await page.getByRole('button', { name: '파견 발령' }).click();
  const assign = page.getByRole('dialog', { name: '파견 발령' });
  await field(page, '새 파견 지점 *').selectOption({ label: '강남점' });
  await assign.getByRole('button', { name: '발령', exact: true }).click();
  await expect(page.getByText('화면채용님을 강남점으로 발령했습니다.')).toBeVisible();
  await expect(page.locator('main')).toContainText('강남점');
});

// 자원문서관리 ADR-RES-04·05 — 인사서류로 올린 문서는 그 직원 상세 "인사서류"에 보이고, 제목을 누르면 파일을 받는다.
test('지점 관리자: 인사서류를 올리면 직원 상세에서 열린다', async ({ page }) => {
  const title = `근로계약서 화면테스트 ${Date.now() % 100000}`;
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  await openMenu(page, '/documents');
  await page.getByRole('button', { name: '+ 문서 등록' }).click();
  const dialog = page.getByRole('dialog', { name: '문서 등록' });
  await field(page, '분류').selectOption({ label: '인사서류' });
  await dialog.locator('input[type=file]').setInputFiles({ name: 'contract.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 hr') });
  await field(page, '제목 *').fill(title);
  const staffSelect = field(page, '대상 직원 *');
  await staffSelect.selectOption((await staffSelect.locator('option', { hasText: '박서연' }).getAttribute('value'))!); // "박서연 (SEOCHO-002)"
  await dialog.getByRole('button', { name: '등록', exact: true }).click();
  await expect(page.getByText('문서를 등록했습니다.')).toBeVisible();

  await openMenu(page, '/staff');
  await page.locator('main tr', { hasText: '박서연' }).first().click();
  const hr = page.locator('.card', { has: page.locator('h3', { hasText: '인사서류' }) });
  await expect(hr.getByRole('button', { name: title })).toBeVisible();
  const download = page.waitForEvent('download');
  await hr.getByRole('button', { name: title }).click();
  expect((await download).suggestedFilename()).toBe('contract.pdf');
});
