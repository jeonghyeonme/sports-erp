import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/**
 * 작업 단계 측정(log/198) — 화면 자동 테스트와 같은 서버·DB 구성으로, 자주 하는 작업을 따라가며 누름·입력·화면 수를 센다.
 * 통과·실패를 보는 테스트가 아니라 측정이라 CI에는 넣지 않는다. 결과는 task-steps/out/results.json·results.md.
 */
export default defineConfig({
  ...base,
  testDir: './task-steps',
  reporter: 'list',
  globalTeardown: './task-steps/report.ts',
  projects: [
    { name: 'admin', testMatch: /admin-.*\.steps\.ts/, use: { ...devices['Desktop Chrome'] } },
    { name: 'member', testMatch: /member-.*\.steps\.ts/, use: { ...devices['Pixel 7'] } },
  ],
});
