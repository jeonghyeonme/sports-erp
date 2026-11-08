import { expect, test } from '@playwright/test';
import { ACCOUNTS, adminLogin, apiAs, field, kstDate } from '../tests/helpers';
import { Steps } from './recorder';

// 지점 관리자(서초 김민수)가 자주 하는 작업 — 로그인 직후 대시보드에서 시작해 메뉴로 옮겨 다닌다(goto 없음).
const nav = (page: import('@playwright/test').Page, href: string) => page.locator(`nav a[href="${href}"]`).first();

test('B01 회원 등록', async ({ page }, info) => {
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  const s = new Steps(page, 'B01', '지점 관리자', '회원 등록');
  s.start();
  await s.click(nav(page, '/members'), '회원 메뉴');
  await s.click(page.getByRole('button', { name: '+ 회원 등록' }), '+ 회원 등록');
  await s.fill(field(page, '이름 *'), `측정회원${Date.now() % 10000}`, '이름');
  await s.fill(field(page, '연락처'), '010-7777-0101', '연락처');
  await s.click(page.getByRole('button', { name: '등록', exact: true }), '등록');
  await expect(page.getByText('회원을 등록했습니다').first()).toBeVisible();
  s.save(info);
});

test('B02 전화번호로 회원 찾아 상세 열기', async ({ page }, info) => {
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  const s = new Steps(page, 'B02', '지점 관리자', '전화번호로 회원 찾아 상세 열기');
  s.start();
  await s.click(nav(page, '/members'), '회원 메뉴');
  await s.fill(page.getByPlaceholder('이름 · 회원번호 · 전화번호'), '5678', '검색어');
  await s.click(page.getByRole('button', { name: '검색' }), '검색');
  await s.click(page.locator('main table tbody tr', { hasText: '이수진' }), '회원 행');
  await expect(page.locator('main h2', { hasText: '이수진' })).toBeVisible();
  s.save(info);
});

test('B03 PT 패키지 등록', async ({ page }, info) => {
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  const s = new Steps(page, 'B03', '지점 관리자', 'PT 패키지 등록');
  s.start();
  await s.click(nav(page, '/members'), '회원 메뉴');
  await s.fill(page.getByPlaceholder('이름 · 회원번호 · 전화번호'), '이수진', '검색어');
  await s.click(page.getByRole('button', { name: '검색' }), '검색');
  await s.click(page.locator('main table tbody tr', { hasText: '이수진' }), '회원 행');
  await s.click(page.getByRole('button', { name: 'PT 잔여세션' }), 'PT 잔여세션 탭');
  await s.click(page.getByRole('button', { name: '+ PT 패키지 등록' }), '+ PT 패키지 등록');
  await s.select(field(page, '프로그램 *'), { label: '퍼스널 트레이닝' }, '프로그램');
  await s.fill(field(page, '세션 수 *'), '10', '세션 수');
  await s.fill(field(page, '구매일 *'), kstDate(0), '구매일(기본값 없음)');
  await s.click(page.getByRole('button', { name: '등록', exact: true }), '등록');
  await expect(page.getByText('10 / 10회 남음')).toBeVisible();
  s.save(info);
});

test('B04 PT 세션 차감', async ({ page }, info) => {
  const admin = await apiAs(ACCOUNTS.seochoAdmin);
  await admin.post('members/member-sujin/pt-sessions', { data: { programId: 'program-seocho-pt', totalSessions: 5, purchasedAt: kstDate(0) } });
  await admin.dispose();
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  const s = new Steps(page, 'B04', '지점 관리자', 'PT 세션 차감(사용)');
  s.start();
  await s.click(nav(page, '/members'), '회원 메뉴');
  await s.fill(page.getByPlaceholder('이름 · 회원번호 · 전화번호'), '이수진', '검색어');
  await s.click(page.getByRole('button', { name: '검색' }), '검색');
  await s.click(page.locator('main table tbody tr', { hasText: '이수진' }), '회원 행');
  await s.click(page.getByRole('button', { name: 'PT 잔여세션' }), 'PT 잔여세션 탭');
  await s.click(page.getByRole('button', { name: '세션 사용' }).first(), '세션 사용');
  await expect(page.getByText(/사용 이력/).first()).toBeVisible();
  s.save(info);
});

test('B05 오늘 예약 회원 체크인', async ({ page }, info) => {
  // 준비: 오늘 늦은 회차 + 회원 예약·결제(화면 대상이 아님 — api)
  const admin = await apiAs(ACCOUNTS.seochoAdmin);
  const slot = await admin.post('programs/program-seocho-yoga/slots', { data: { date: kstDate(0), startTime: '23:00', endTime: '23:50' } });
  expect(slot.ok(), await slot.text()).toBeTruthy();
  const slotId = (await slot.json()).data.id as string;
  await admin.dispose();
  const member = await apiAs(ACCOUNTS.seochoMember);
  const r = await member.post('reservations', { data: { scheduleSlotId: slotId } });
  expect(r.ok(), await r.text()).toBeTruthy();
  const pay = await member.post(`payments/${(await r.json()).data.id}/mock-pay`, { data: {} });
  expect(pay.ok(), await pay.text()).toBeTruthy();
  await member.dispose();

  await adminLogin(page, ACCOUNTS.seochoAdmin);
  const s = new Steps(page, 'B05', '지점 관리자', '오늘 예약 회원 체크인');
  s.start();
  await s.click(nav(page, '/reservations'), '예약 메뉴');
  await s.click(page.locator('main tr', { hasText: '23:00' }).getByRole('button', { name: '체크인' }), '체크인');
  await expect(page.locator('main tr', { hasText: '23:00' })).toContainText('체크인');
  s.save(info);
});

test('B06 직원 휴가 승인(처리 대기함에서)', async ({ page }, info) => {
  const staff = await apiAs(ACCOUNTS.seochoStaff);
  const res = await staff.post('leave-requests', { data: { type: 'ANNUAL', startDate: kstDate(20), endDate: kstDate(20) } });
  expect(res.status()).toBe(201);
  await staff.dispose();
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  const s = new Steps(page, 'B06', '지점 관리자', '직원 휴가 승인(처리 대기함에서)');
  s.start();
  await s.click(page.locator('.inbox-card').getByRole('link', { name: /승인 대기 휴가/ }), '처리 대기: 승인 대기 휴가');
  const approvals = page.locator('div', { has: page.locator('h3', { hasText: '휴가 승인함' }) }).last();
  await s.click(approvals.locator('tr', { hasText: kstDate(20) }).getByRole('button', { name: '승인' }), '승인');
  await expect(approvals.locator('tr', { hasText: kstDate(20) })).toHaveCount(0);
  s.save(info);
});

test('B07 혼잡도 현장 인원 입력', async ({ page }, info) => {
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  const s = new Steps(page, 'B07', '지점 관리자', '혼잡도 현장 인원 입력');
  s.start();
  await s.click(nav(page, '/facilities'), '시설·혼잡도 메뉴');
  const card = page.locator('.card', { hasText: '서초점 헬스장' }).first();
  await s.fill(card.getByLabel('예약 외 현장 인원'), '9', '현장 인원');
  await s.click(card.getByRole('button', { name: '입력' }), '입력');
  await expect(card).toContainText('현장 9명');
  s.save(info);
});

test('B08 회차 등록', async ({ page }, info) => {
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  const s = new Steps(page, 'B08', '지점 관리자', '회차 등록');
  s.start();
  await s.click(nav(page, '/reservations'), '예약 메뉴');
  const form = page.locator('form', { has: page.locator('label', { hasText: '정원(비우면' }) });
  await s.select(form.locator('select').first(), { label: '아침 요가' }, '프로그램');
  await s.fill(form.locator('.field', { hasText: '날짜' }).locator('input'), kstDate(2), '날짜');
  await s.fill(form.locator('.field', { hasText: '시작' }).locator('input'), '18:00', '시작');
  await s.fill(form.locator('.field', { hasText: '종료' }).locator('input'), '19:00', '종료');
  await s.click(form.getByRole('button', { name: '회차 추가' }), '회차 추가');
  await expect(page.getByText('회차를 등록했습니다.')).toBeVisible();
  s.save(info);
});

test('B09 시설 공지 작성(글만)', async ({ page }, info) => {
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  const s = new Steps(page, 'B09', '지점 관리자', '시설 공지 작성(글만)');
  s.start();
  await s.click(nav(page, '/board'), '게시판 메뉴');
  await s.click(page.getByRole('button', { name: '+ 글쓰기' }), '+ 글쓰기');
  await s.fill(field(page, '제목 *'), '수영장 점검 안내', '제목');
  await s.type(page.getByRole('textbox', { name: '내용' }), '내일 오전 수영장 점검으로 휴장합니다.', '내용');
  await s.select(field(page, '대상 시설'), { label: '서초점 수영장' }, '대상 시설');
  await s.click(page.getByRole('button', { name: '등록', exact: true }), '등록');
  await expect(page).toHaveURL(/\/board\/[^/]+$/);
  s.save(info);
});

test('B10 직원 근태 누락일 등록', async ({ page }, info) => {
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  const s = new Steps(page, 'B10', '지점 관리자', '직원 근태 누락일 등록');
  s.start();
  await s.click(nav(page, '/staff'), '직원 메뉴');
  await s.click(page.locator('main tr', { hasText: '박서연' }).first(), '직원 행');
  await s.click(page.getByRole('button', { name: '+ 누락일 등록' }), '+ 누락일 등록');
  const modal = page.locator('.modal-card').last();
  await s.fill(modal.locator('.field', { hasText: '날짜' }).locator('input'), kstDate(-3), '날짜');
  await s.fill(modal.locator('.field', { hasText: '출근 시각' }).locator('input'), '09:00', '출근 시각');
  await s.fill(modal.locator('.field', { hasText: '퇴근 시각' }).locator('input'), '18:00', '퇴근 시각');
  await s.fill(modal.locator('.field', { hasText: '정정 사유' }).locator('input'), '체크인 누락 확인', '정정 사유');
  await s.click(modal.getByRole('button', { name: '저장' }), '저장');
  await expect(modal).toHaveCount(0);
  s.save(info);
});
