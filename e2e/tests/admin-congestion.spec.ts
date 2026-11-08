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

// D74 — 확인은 브라우저 confirm이 아니라 확인 창(dialog). Esc는 취소, 버튼은 실행. 다른 테스트가 헬스장을 쓰므로 수영장으로 보고 되돌린다.
test('지점 관리자: 시설 운영 중단은 확인 창에서 — Esc는 취소, "운영 중단"은 실행', async ({ page }) => {
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  await openMenu(page, '/facilities');
  const card = page.locator('.card', { hasText: '서초점 수영장' }).first();
  await card.getByRole('button', { name: '운영 중단' }).click();
  const dialog = page.getByRole('dialog', { name: '시설 운영 중단' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(card.locator('.badge.PAUSED')).toHaveCount(0); // 취소했으니 그대로 운영 중

  await card.getByRole('button', { name: '운영 중단' }).click();
  await dialog.getByRole('button', { name: '운영 중단' }).click();
  await expect(page.getByText("'서초점 수영장'을(를) 운영 중단했습니다.")).toBeVisible();
  // 되돌리기 — "운영 중단" 탭에서 다시 운영
  await page.locator('.filter-chip', { hasText: '운영 중단' }).click();
  await page.locator('.card', { hasText: '서초점 수영장' }).getByRole('button', { name: '재활성화' }).click();
  await expect(page.getByText("'서초점 수영장'을(를) 다시 운영합니다.")).toBeVisible();
});
