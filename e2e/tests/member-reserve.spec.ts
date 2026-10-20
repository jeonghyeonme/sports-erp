import { expect, test } from '@playwright/test';
import { ACCOUNTS, apiAs, kstDate, memberLogin } from './helpers';

// 회원(서초 이수진) — 프로그램 → 회차 예약 → 모의 결제 → 내 예약 → 취소. 회차는 api로 미리 만든다
// (기준 시드의 회차는 지난 날짜다 — 회차 등록 화면은 admin-branch가 본다).
test('회원: 회차를 예약·결제하고 내 예약에서 취소한다', async ({ page }) => {
  const admin = await apiAs(ACCOUNTS.seochoAdmin);
  const date = kstDate(3);
  const slot = await admin.post('programs/program-seocho-yoga/slots', { data: { date, startTime: '06:30', endTime: '07:30' } });
  expect(slot.ok(), await slot.text()).toBeTruthy();
  await admin.dispose();

  await memberLogin(page, ACCOUNTS.seochoMember);
  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '예약하기' }).click(); // 하단 탭
  await page.getByText('아침 요가').first().click();
  // 날짜 띠(ADR-RSV-06)는 가장 가까운 회차 날을 먼저 고른다 — 다른 테스트가 만든 회차가 있을 수 있어 날짜를 직접 고른다.
  const [, m, d] = date.split('-').map(Number);
  await page.getByRole('tab', { name: new RegExp(`^${m}월 ${d}일`) }).click();
  await page.getByText('06:30').first().click();
  await page.getByRole('button', { name: /예약/ }).first().click();
  await page.getByRole('button', { name: /결제/ }).first().click();
  await expect(page.getByText('예약이 확정됐습니다.')).toBeVisible();

  await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '내 예약' }).click(); // 하단 탭
  const card = page.locator('li, article, .panel', { hasText: '06:30' }).first();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: '예약 취소' }).click();
  // 확인은 아래에서 올라오는 시트(BottomSheet)에서 한 번 더 누른다.
  const sheet = page.locator('[role=dialog]', { hasText: '예약을 취소할까요?' });
  await sheet.getByRole('button', { name: '예약 취소' }).click();
  // 결제한 예약을 마감 전에 취소하면 환불된다(예약및결제 A-6) — 지난·취소한 예약 목록으로 옮겨 간다.
  const past = page.locator('section, div', { has: page.locator('h2', { hasText: '지난·취소한 예약' }) }).last();
  await expect(past).toContainText('취소·환불');
});
