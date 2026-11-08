import { expect, test } from '@playwright/test';
import { ACCOUNTS, adminLogin, apiAs, field, kstDate, openMenu } from './helpers';

// 지점 관리자(서초 김민수)의 하루 업무 — 회원 등록·검색, 회차 등록, 시설 지정 공지 작성(서식 편집기·D62)과 이미지 첨부·수정.

test('지점 관리자: 회원을 등록하고 검색으로 찾는다', async ({ page }) => {
  const name = `화면테스트${Date.now() % 100000}`;
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  await openMenu(page, '/members');
  await page.getByRole('button', { name: '+ 회원 등록' }).click();
  await field(page, '이름 *').fill(name);
  await field(page, '연락처').fill('010-5555-0101');
  await page.getByRole('button', { name: '등록', exact: true }).click();

  await page.getByPlaceholder('이름 · 회원번호 · 전화번호').fill(name); // D74 — 치는 대로 검색(검색 버튼 없음)
  const row = page.locator('main table tbody tr', { hasText: name });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('010-****-0101'); // 목록은 전화번호 마스킹(ADR-MEM-04)
});

// D72 — 상단 바 회원 빠른 찾기: 어느 화면에서든 2자 이상 치면 결과가 뜨고, 고르면 회원 상세로. 남은 PT가 있으면 PT 탭이 먼저,
// 탭은 주소(?tab=)에 남는다. 다른 지점 회원은 결과에 없다(목록 API의 지점 격리 — D46).
test('지점 관리자: 상단 회원 찾기로 상세에 바로 가고, 남은 PT가 있으면 PT 탭이 먼저 열린다', async ({ page }) => {
  const admin = await apiAs(ACCOUNTS.seochoAdmin);
  const pt = await admin.post('members/member-sujin/pt-sessions', {
    data: { programId: 'program-seocho-pt', totalSessions: 3, purchasedAt: kstDate(0) },
  });
  expect(pt.ok(), await pt.text()).toBeTruthy();
  await admin.dispose();

  await adminLogin(page, ACCOUNTS.seochoAdmin);
  await openMenu(page, '/facilities'); // 회원 화면이 아닌 곳에서 시작
  const search = page.getByRole('combobox', { name: '회원 빠른 찾기' });
  await search.fill('오영'); // 강남점 회원 — 서초 지점 관리자에게는 나오지 않는다
  await expect(page.locator('.quick-search-note')).toHaveText('일치하는 회원이 없습니다.');
  await search.fill('이수');
  await page.getByRole('option', { name: /이수진/ }).click();
  await expect(page).toHaveURL(/\/members\/member-sujin$/);
  await expect(page.getByRole('button', { name: '세션 사용' }).first()).toBeVisible();

  await page.getByRole('button', { name: '수강내역' }).click();
  await expect(page).toHaveURL(/\/members\/member-sujin\?tab=enrollments$/);
});

// D74 — 화면 전체 로드 목록은 머리글을 눌러 정렬한다(오름 → 내림 → 해제), 지금 방향은 aria-sort.
test('지점 관리자: 프로그램 목록 머리글을 누르면 이름순·역순으로 정렬된다', async ({ page }) => {
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  await openMenu(page, '/programs');
  const header = page.getByRole('columnheader', { name: /프로그램명/ });
  const names = async () => (await page.locator('main table tbody tr td:first-child').allInnerTexts()).map((t) => t.trim());
  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'ascending');
  const asc = await names();
  expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b, 'ko', { numeric: true })));
  await header.getByRole('button').click();
  await expect(header).toHaveAttribute('aria-sort', 'descending');
  expect(await names()).toEqual([...asc].reverse());
});

test('지점 관리자: 내일 회차를 등록하면 주간 시간표에 보인다', async ({ page }) => {
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  await openMenu(page, '/reservations');
  await page.getByRole('button', { name: '+ 회차 등록' }).click(); // D73 — 머리글 버튼 + 모달
  const form = page.locator('.modal-card form');
  await form.locator('select').first().selectOption({ label: '아침 요가' });
  await form.locator('.field', { hasText: '날짜' }).locator('input').fill(kstDate(1));
  await form.locator('.field', { hasText: '시작' }).locator('input').fill('19:00');
  await form.locator('.field', { hasText: '종료' }).locator('input').fill('20:00');
  await form.getByRole('button', { name: '회차 추가' }).click();
  await expect(page.getByText('회차를 등록했습니다.')).toBeVisible();
  // 시간표는 이번 주(월~일)를 먼저 보인다 — 오늘이 일요일(KST)이면 내일은 다음 주라 넘겨서 본다(log/201: 일요일마다 실패하던 것).
  if (new Date(`${kstDate(1)}T00:00:00Z`).getUTCDay() === 1) await page.getByRole('button', { name: '다음 주 →' }).click();
  await expect(page.locator('section, div', { hasText: '주간 시간표' }).getByText('19:00').first()).toBeVisible();
});

test('지점 관리자: 작성 화면에서 서식 있는 공지를 쓰고 이미지를 붙인 뒤, 수정 화면에서 본문을 고친다', async ({ page }) => {
  const title = `화면테스트 공지 ${Date.now() % 100000}`;
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  await openMenu(page, '/board');
  // D62 — 글쓰기는 모달이 아니라 별도 작성 화면(서식 편집기 + 첨부)
  await page.getByRole('button', { name: '+ 글쓰기' }).click();
  await expect(page).toHaveURL(/\/board\/new$/);
  await field(page, '제목 *').fill(title);
  const body = page.getByRole('textbox', { name: '내용' });
  await body.click();
  await page.keyboard.type('수영장 점검 안내입니다. ');
  await page.getByRole('button', { name: '굵게' }).click();
  await page.keyboard.type('오전 휴장');
  await page.getByRole('button', { name: '굵게' }).click(); // 다시 눌러 끈다
  await page.keyboard.type(' 예정');
  // 한 문단 안에서 고른 부분만 제목이 된다(문단 전체가 아니라)
  await page.keyboard.press('Home');
  for (let i = 0; i < '수영장 점검'.length; i++) await page.keyboard.press('Shift+ArrowRight');
  await page.getByRole('button', { name: '제목', exact: true }).click();
  await expect(body.locator('h2')).toHaveText('수영장 점검');
  await expect(body.locator('p').first()).toContainText('안내입니다.');
  // 링크는 편집기 안 입력칸으로(브라우저 prompt 아님) — 잘못된 주소는 안내, Enter는 글을 제출하지 않는다
  await page.keyboard.press('Control+End');
  await page.getByRole('button', { name: '링크' }).click();
  const linkField = page.getByRole('textbox', { name: '링크 주소' });
  await linkField.fill('javascript:alert(1)');
  await linkField.press('Enter');
  await expect(page.locator('.rich-link-error')).toBeVisible();
  await linkField.fill('https://spoism.example/notice');
  await linkField.press('Enter');
  await expect(page).toHaveURL(/\/board\/new$/);
  await expect(body.locator('a')).toHaveAttribute('href', 'https://spoism.example/notice');
  // 지점 관리자의 글은 지점 공지(현장 → 이용자)라 공개 범위 선택이 없다 — 회원 공개 여부는 member-notice가 본다.
  // 대상 시설(게시판 ADR-BRD-05, RFP F4-3) — 첫 시설을 고른다.
  const facilitySelect = field(page, '대상 시설');
  await expect(facilitySelect.locator('option')).not.toHaveCount(1);
  await facilitySelect.selectOption({ index: 1 });
  const facilityName = (await facilitySelect.locator('option:checked').innerText()).trim();
  // 첨부는 골라 두면 등록할 때 함께 올라간다
  await page.locator('input[type=file]').setInputFiles({ name: 'notice.png', mimeType: 'image/png', buffer: PNG_1PX });
  await expect(page.locator('.attachment-list')).toContainText('notice.png');
  await page.getByRole('button', { name: '등록', exact: true }).click();

  // 등록하면 상세로 — 서식(굵게)이 살아 있고, 이미지는 목록 위에 바로 그려진다(log/144)
  await expect(page).toHaveURL(/\/board\/[^/]+$/);
  const main = page.locator('main');
  await expect(main).toContainText('수영장 점검 안내입니다.');
  await expect(main.locator('.rich-content strong')).toHaveText('오전 휴장');
  await expect(main.locator('.rich-content h2')).toHaveText('수영장 점검');
  await expect(main.locator('.rich-content a')).toHaveAttribute('href', 'https://spoism.example/notice');
  await expect(main).toContainText(`대상 시설 ${facilityName}`);
  await expect(page.locator('.attachment-list')).toContainText('notice.png');
  await expect(page.locator('img.attachment-image')).toHaveJSProperty('complete', true);
  expect(await page.locator('img.attachment-image').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1);

  // 수정 — 본문과 첨부를 한 화면에서
  await page.getByRole('button', { name: '수정' }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await expect(page.locator('.attachment-list')).toContainText('notice.png');
  const editBody = page.getByRole('textbox', { name: '내용' });
  await expect(editBody).toContainText('오전 휴장');
  await editBody.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('오후 2시부터 정상 운영');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page).toHaveURL(/\/board\/[^/]+$/);
  await expect(main).toContainText('오후 2시부터 정상 운영');
  await expect(main.locator('.rich-content strong')).toHaveText('오전 휴장');
});

// 1×1 PNG
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
