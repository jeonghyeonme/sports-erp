import { expect, test } from '@playwright/test';
import { ACCOUNTS, adminLogin, apiAs, openMenu } from './helpers';

// D60 2단계 — 본사가 권한 관리 화면에서 역할 기본 권한을 끄면 지점 관리자 전원이 막히고,
// 직원 상세 "개인 권한"에서 한 사람만 되살린다. 막힘 확인은 api로(화면 숨김은 3단계).
test('본사: 역할 기본 권한을 끄고 한 사람만 개인 권한으로 되살린다', async ({ page }) => {
  const body = { category: 'OTHER', title: '화면테스트 권한', content: '권한 확인' };
  const minsu = await apiAs(ACCOUNTS.seochoAdmin);
  expect((await minsu.post('support-requests', { data: body })).status()).toBe(201); // 대조군

  await adminLogin(page, ACCOUNTS.hq);
  await openMenu(page, '/permissions');
  await page.getByRole('button', { name: '역할 기본 권한' }).click();
  const cell = page.getByRole('checkbox', { name: '지점 관리자 업무지원 요청 입력' });
  await expect(cell).toBeChecked();
  await cell.click(); // 체크 상태는 서버 응답 뒤에 바뀐다(제어 컴포넌트) — uncheck()는 즉시 바뀌길 기대해 실패한다
  await expect(page.getByText('역할 기본 권한을 바꿨습니다')).toBeVisible();
  await expect(cell).not.toBeChecked();
  const denied = await minsu.post('support-requests', { data: body });
  expect([denied.status(), (await denied.json()).error.code]).toEqual([403, 'PERMISSION_DENIED']);

  // 직원 상세 → 개인 권한에서 김민수만 허용
  await openMenu(page, '/staff');
  await page.getByPlaceholder('이름·직원코드·지점명 검색').fill('김민수');
  // 검색으로 지점 묶음이 하나만 남으면 자동으로 펼쳐진다(AUTO_EXPAND_THRESHOLD)
  await page.locator('tr', { hasText: '김민수' }).first().click();
  const personal = page.locator('.card', { hasText: '개인 권한' }).getByRole('combobox', { name: '업무지원 요청 입력' });
  await expect(personal).toHaveValue('DEFAULT');
  await personal.selectOption('ALLOW');
  await expect(page.getByText('개인 권한을 바꿨습니다')).toBeVisible();
  expect((await minsu.post('support-requests', { data: body })).status()).toBe(201);

  // 뒷정리 — 다른 화면 테스트가 같은 DB를 쓴다
  const hq = await apiAs(ACCOUNTS.hq);
  await hq.put('permissions/staff/staff-minsu/overrides', { data: { feature: 'support', action: 'CREATE', mode: 'DEFAULT' } });
  await hq.put('permissions/roles/BRANCH_ADMIN', { data: { feature: 'support', action: 'CREATE', allowed: true } });
  await hq.dispose();
  await minsu.dispose();
});

// D60 3단계 — 꺼진 권한의 메뉴·버튼은 지점 관리자 화면에서 사라진다. 로그인한 채로 본사가 바꾸면
// 창으로 돌아올 때(focus) /auth/me로 다시 받아 반영된다 — 같은 화면에서 "보이던 것이 사라짐"으로 확인한다.
test('지점 관리자: 권한이 꺼지면 메뉴·등록 버튼·CSV 버튼이 사라진다', async ({ page }) => {
  await adminLogin(page, ACCOUNTS.seochoAdmin);
  await openMenu(page, '/members');
  await expect(page.getByRole('button', { name: '+ 회원 등록' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'CSV 내려받기' })).toBeVisible();
  await expect(page.locator('nav a[href="/support-requests"]')).toHaveCount(1);

  const hq = await apiAs(ACCOUNTS.hq);
  const cells = [
    { feature: 'member', action: 'CREATE' },
    { feature: 'support', action: 'READ' },
  ];
  try {
    for (const c of cells) await hq.put('permissions/roles/BRANCH_ADMIN', { data: { ...c, allowed: false } });
    await hq.put('permissions/staff/staff-minsu/overrides', { data: { feature: 'member', action: 'EXPORT', mode: 'DENY' } });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));

    await expect(page.getByRole('button', { name: '+ 회원 등록' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'CSV 내려받기' })).toHaveCount(0);
    await expect(page.locator('nav a[href="/support-requests"]')).toHaveCount(0);
    await expect(page.locator('main table')).toBeVisible(); // 조회는 그대로
    await openMenu(page, '/board');
    await expect(page.getByRole('button', { name: '+ 글쓰기' })).toBeVisible(); // 대조군
  } finally {
    for (const c of cells) await hq.put('permissions/roles/BRANCH_ADMIN', { data: { ...c, allowed: true } });
    await hq.put('permissions/staff/staff-minsu/overrides', { data: { feature: 'member', action: 'EXPORT', mode: 'DEFAULT' } });
    await hq.dispose();
  }
});
