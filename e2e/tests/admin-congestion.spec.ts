import { expect, test } from '@playwright/test';
import { ACCOUNTS, adminLogin, openMenu } from './helpers';

// ADR-FAC-05 — 지점 관리자가 넣는 값은 "예약 외 현장 인원"이고, 카드는 예약 + 현장 합계와 구성을 보인다.
test('지점 관리자: 현장 인원을 입력하면 합계와 구성이 바뀐다', async ({ page }) => {
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  await openMenu(page, '/facilities');
  const card = page.locator('.card', { hasText: '서초점 헬스장' }).first();
  await card.getByLabel('예약 외 현장 인원').fill('7');
  await card.getByRole('button', { name: '입력' }).click();
  await expect(card).toContainText(/진행 중 강습\(예약\) \d+명 \+ 현장 7명/);
  await expect(card).toContainText('현장 인원 방금 갱신');
});
