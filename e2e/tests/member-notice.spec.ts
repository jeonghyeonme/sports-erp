import { expect, test } from '@playwright/test';
import { ACCOUNTS, apiAs, memberLogin } from './helpers';

// 회원 웹 공지 — 시설로 거른 목록 → 상세(ADR-BRD-05), 서식 본문은 정화해 그리고(D62), 첨부 이미지는 본문 아래에 그려진다(log/137). 공지·첨부는 api로 만든다.
test('회원: 공지 상세에서 첨부 이미지를 본다', async ({ page }) => {
  const admin = await apiAs(ACCOUNTS.seochoAdmin);
  const title = `회원 공지 ${Date.now() % 100000}`;
  // 대상 시설(게시판 ADR-BRD-05) — 회원 목록의 시설 고르기로 이 글이 걸러지는지 본다.
  const facility = (await (await admin.get('facilities')).json()).data[0] as { id: string; name: string };
  const post = await (
    await admin.post('posts', { data: { title, content: '<p>이미지 첨부 <strong>확인</strong></p><script>window.__xss = 1</script><p><a href="javascript:window.__xss=2">링크</a></p>', category: 'NOTICE', facilityId: facility.id } })
  ).json();
  const id = post.data.id as string;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const up = (await (await admin.post(`posts/${id}/attachments/upload-url`, { data: { fileName: 'a.png', fileType: 'image/png', fileSize: png.length } })).json()).data;
  expect((await admin.put(up.uploadUrl, { data: png, headers: { 'Content-Type': 'image/png' } })).ok()).toBeTruthy();
  expect((await admin.post(`posts/${id}/attachments`, { data: { path: up.path, fileName: 'a.png' } })).ok()).toBeTruthy();
  await admin.dispose();

  await memberLogin(page, ACCOUNTS.seochoMember);
  await page.goto('/m/notices');
  await page.locator('.field', { hasText: '시설' }).locator('select').selectOption(facility.id);
  await expect(page.locator('.notice-card', { hasText: title })).toContainText(facility.name);
  await page.getByText(title).click();
  await expect(page.locator('article')).toContainText(facility.name);
  await expect(page.locator('.notice-body strong')).toHaveText('확인');
  // D62 — 서버 정화 + DOMPurify: 스크립트·javascript: 링크는 남지 않는다
  await expect(page.locator('.notice-body script')).toHaveCount(0);
  await expect(page.locator('.notice-body a')).not.toHaveAttribute('href', /javascript/);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  await expect(page.locator('img.notice-image')).toHaveJSProperty('complete', true);
  expect(await page.locator('img.notice-image').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(1);
});
