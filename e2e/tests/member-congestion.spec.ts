import { expect, test } from '@playwright/test';
import { ACCOUNTS, memberLogin } from './helpers';

// ADR-FAC-05 — 회원 홈 혼잡도 카드는 시설마다 "약 N명/정원 · 강습(예약) + 현장 (현장 입력 시각)"을 보인다.
// 예약 인원 합산 규칙 자체는 api jest(facility-occupancy)가 본다 — 예약은 시작 전 회차만 받아 화면에서 진행 중 회차를 만들 수 없다.
test('회원: 홈 혼잡도 카드에 예약·현장 인원 구성이 보인다', async ({ page }) => {
  await memberLogin(page, ACCOUNTS.seochoMember);
  const card = page.locator('section[aria-labelledby="congestion-title"]');
  await expect(card).toBeVisible();
  await expect(card.locator('.congestion-detail').first()).toHaveText(
    /약 \d+명\/\d+ · 강습 \d+ \+ 현장 \d+ \(.+\)/,
  );
});
