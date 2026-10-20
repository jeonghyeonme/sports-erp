import { APIRequestContext, Page, expect, request } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { API_PORT, ROOT } from '../env';

// 데모 계정(apps/api/test/helpers/app.ts ACCOUNTS와 같다). 비밀번호는 시드가 쓰는 공개 데모 값.
export const ACCOUNTS = {
  hq: 'jeong.haneul@spoism.example',
  seochoAdmin: 'kim.minsu@spoism.example',
  seochoStaff: 'park.seoyeon@spoism.example',
  seochoMember: 'lee.sujin@example.com',
} as const;
export const PASSWORD = readFileSync(join(ROOT, 'apps/api/src/fixtures/demo-password.ts'), 'utf8').match(/'([^']+)'/)![1];

/** KST 기준 오늘에서 n일 뒤(YYYY-MM-DD). */
export function kstDate(offsetDays = 0): string {
  const d = new Date(Date.now() + 9 * 3600_000 + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/**
 * 관리자 웹 로그인. 액세스 토큰을 메모리에만 두므로(system-overview §3.2) 로그인 뒤에는 page.goto 대신
 * 메뉴를 눌러 옮겨 다닌다 — goto는 새로고침이라 로그인이 풀린다.
 */
export async function adminLogin(page: Page, email: string) {
  await page.goto('/login');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await expect(page).not.toHaveURL(/\/login$/);
}

export async function openMenu(page: Page, href: string) {
  await page.locator(`nav a[href="${href}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`${href === '/' ? '/$' : href}`));
}

/** 회원 웹 로그인(갱신 토큰을 localStorage에 두어 goto로 옮겨 다녀도 세션이 유지된다, D41). */
export async function memberLogin(page: Page, email: string) {
  await page.goto('/m/login');
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.locator('button[type=submit]').click();
  await expect(page).not.toHaveURL(/\/m\/login$/);
}

/** 화면 앞 준비 단계(데이터 만들기)는 api로 직접 — 그 화면이 테스트 대상이 아닐 때만 쓴다. */
export async function apiAs(email: string): Promise<APIRequestContext> {
  const base = `http://localhost:${API_PORT}/api/v1/`;
  const anon = await request.newContext({ baseURL: base });
  const res = await anon.post('auth/login', { data: { email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  const token = (await res.json()).data.accessToken as string;
  await anon.dispose();
  return request.newContext({ baseURL: base, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
}

/** 라벨이 입력과 연결돼 있지 않은 폼(.field > label + input)에서 라벨 글자로 입력을 찾는다. */
export function field(page: Page, label: string) {
  return page.locator('.field', { has: page.locator('label', { hasText: label }) }).locator('input, select, textarea').first();
}
