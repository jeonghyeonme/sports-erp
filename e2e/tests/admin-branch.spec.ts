import { expect, test } from '@playwright/test';
import { ACCOUNTS, adminLogin, field, kstDate, openMenu } from './helpers';

// 지점 관리자(서초 김민수)의 하루 업무 — 회원 등록·검색, 회차 등록, 시설 지정 공지 작성과 이미지 첨부.

test('지점 관리자: 회원을 등록하고 검색으로 찾는다', async ({ page }) => {
  const name = `화면테스트${Date.now() % 100000}`;
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  await openMenu(page, '/members');
  await page.getByRole('button', { name: '+ 회원 등록' }).click();
  await field(page, '이름 *').fill(name);
  await field(page, '연락처').fill('010-5555-0101');
  await page.getByRole('button', { name: '등록', exact: true }).click();

  await page.getByPlaceholder('이름 · 회원번호 · 전화번호').fill(name);
  await page.getByRole('button', { name: '검색' }).click();
  const row = page.locator('main table tbody tr', { hasText: name });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('010-****-0101'); // 목록은 전화번호 마스킹(ADR-MEM-04)
});

test('지점 관리자: 내일 회차를 등록하면 주간 시간표에 보인다', async ({ page }) => {
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  await openMenu(page, '/reservations');
  const form = page.locator('form', { has: page.locator('label', { hasText: '정원(비우면' }) });
  await form.locator('select').first().selectOption({ label: '아침 요가' });
  await form.locator('.field', { hasText: '날짜' }).locator('input').fill(kstDate(1));
  await form.locator('.field', { hasText: '시작' }).locator('input').fill('19:00');
  await form.locator('.field', { hasText: '종료' }).locator('input').fill('20:00');
  await form.getByRole('button', { name: '회차 추가' }).click();
  await expect(page.getByText('회차를 등록했습니다.')).toBeVisible();
  await expect(page.locator('section, div', { hasText: '주간 시간표' }).getByText('19:00').first()).toBeVisible();
});

test('지점 관리자: 지점 공지를 쓰고 이미지를 붙인다', async ({ page }) => {
  const title = `화면테스트 공지 ${Date.now() % 100000}`;
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  await openMenu(page, '/board');
  await page.getByRole('button', { name: '+ 글쓰기' }).click();
  await field(page, '제목 *').fill(title);
  await field(page, '내용 *').fill('수영장 점검 안내입니다.');
  // 지점 관리자의 글은 지점 공지(현장 → 이용자)라 공개 범위 선택이 없다 — 회원 공개 여부는 member-notice가 본다.
  // 대상 시설(게시판 ADR-BRD-05, RFP F4-3) — 첫 시설을 고른다.
  const facilitySelect = field(page, '대상 시설');
  await expect(facilitySelect.locator('option')).not.toHaveCount(1);
  await facilitySelect.selectOption({ index: 1 });
  const facilityName = (await facilitySelect.locator('option:checked').innerText()).trim();
  await page.getByRole('button', { name: '등록', exact: true }).click();

  await expect(page.locator('.card', { hasText: title })).toContainText(facilityName);
  await page.getByText(title).first().click();
  await expect(page.locator('main')).toContainText('수영장 점검 안내입니다.');
  await expect(page.locator('main')).toContainText(`대상 시설 ${facilityName}`);
  await page.locator('input[type=file]').setInputFiles({ name: 'notice.png', mimeType: 'image/png', buffer: PNG_1PX });
  await expect(page.locator('.attachment-list')).toContainText('notice.png');
  // 이미지는 목록 위에 바로 그려진다(log/144).
  await expect(page.locator('img.attachment-image')).toHaveJSProperty('complete', true);
  expect(await page.locator('img.attachment-image').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1);
});

// 1×1 PNG
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
