import { expect, test } from '@playwright/test';
import { ACCOUNTS, apiAs, kstDate, memberLogin } from '../tests/helpers';
import { Steps } from './recorder';

// 회원(서초 이수진) — 휴대폰(Pixel 7) 화면, 로그인 직후 홈에서 시작.
const tab = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name });

test('M01 프로그램 예약·결제', async ({ page }, info) => {
  const admin = await apiAs(ACCOUNTS.seochoAdmin);
  const date = kstDate(4);
  const slot = await admin.post('programs/program-seocho-yoga/slots', { data: { date, startTime: '07:00', endTime: '08:00' } });
  expect(slot.ok(), await slot.text()).toBeTruthy();
  await admin.dispose();
  await memberLogin(page, ACCOUNTS.seochoMember);
  const s = new Steps(page, 'M01', '회원', '프로그램 예약·결제');
  s.start();
  await s.click(tab(page, '예약하기'), '예약하기 탭');
  await s.click(page.getByText('아침 요가').first(), '프로그램');
  const [, m, d] = date.split('-').map(Number);
  await s.click(page.getByRole('tab', { name: new RegExp(`^${m}월 ${d}일`) }), '날짜');
  await s.click(page.getByText('07:00').first(), '회차');
  await s.click(page.getByRole('button', { name: /예약/ }).first(), '예약');
  await s.click(page.getByRole('button', { name: /결제/ }).first(), '결제');
  await expect(page.getByText('예약이 확정됐습니다.')).toBeVisible();
  s.save(info);
});

test('M02 예약 취소', async ({ page }, info) => {
  const admin = await apiAs(ACCOUNTS.seochoAdmin);
  const slot = await admin.post('programs/program-seocho-yoga/slots', { data: { date: kstDate(5), startTime: '21:00', endTime: '22:00' } });
  const slotId = (await slot.json()).data.id as string;
  await admin.dispose();
  const member = await apiAs(ACCOUNTS.seochoMember);
  const r = await member.post('reservations', { data: { scheduleSlotId: slotId } });
  await member.post(`payments/${(await r.json()).data.id}/mock-pay`, { data: {} });
  await member.dispose();
  await memberLogin(page, ACCOUNTS.seochoMember);
  const s = new Steps(page, 'M02', '회원', '예약 취소');
  s.start();
  await s.click(tab(page, '내 예약'), '내 예약 탭');
  const card = page.locator('li, article, .panel', { hasText: '21:00' }).first();
  await s.click(card.getByRole('button', { name: '예약 취소' }), '예약 취소');
  await s.click(page.locator('[role=dialog]', { hasText: '예약을 취소할까요?' }).getByRole('button', { name: '예약 취소' }), '시트에서 확인');
  await expect(page.getByText('취소·환불').first()).toBeVisible();
  s.save(info);
});

test('M03 공지 읽기', async ({ page }, info) => {
  await memberLogin(page, ACCOUNTS.seochoMember);
  const s = new Steps(page, 'M03', '회원', '공지 읽기');
  s.start();
  // 공지는 하단 탭이 없고 홈의 "최근 공지 3건"에서 들어간다
  await s.click(page.locator('a.notice-row').first(), '홈 최근 공지 항목');
  await expect(page).toHaveURL(/\/m\/notices\/.+/);
  s.save(info);
});
