import { defineConfig, devices } from '@playwright/test';
import { API_PORT, E2E_DATABASE_URL, ROOT, WEB_PORT } from './env';

/**
 * 관리자 웹·회원 웹 화면 자동 테스트(D59). 빌드한 화면(`npm run build:web`)과 빌드한 api(`apps/api/dist`)를
 * 운영과 같은 구조(같은 오리진, /api 프록시)로 띄워 역할별 핵심 경로를 브라우저로 따라간다.
 * 테스트끼리 같은 DB를 쓰므로 직렬로 돌린다(workers 1). 시각은 서울 기준(KST "오늘" 계산을 운영과 같게).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    timezoneId: 'Asia/Seoul',
    locale: 'ko-KR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // 세션 컨테이너처럼 브라우저가 미리 깔린 곳은 PW_CHROMIUM_PATH로 그 실행 파일을 쓴다(CI는 playwright install).
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'admin', testMatch: /admin-.*\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    { name: 'member', testMatch: /member-.*\.spec\.ts/, use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      // DB 초기화 → api 시작. 초기화가 실패하면 api도 뜨지 않아 테스트가 돌지 않는다.
      command: 'node e2e/reset-db.mjs && node apps/api/dist/main.js',
      cwd: ROOT,
      url: `http://localhost:${API_PORT}/api/v1/health`,
      reuseExistingServer: false,
      env: { DATABASE_URL: E2E_DATABASE_URL, DIRECT_URL: E2E_DATABASE_URL, PORT: String(API_PORT) },
      timeout: 120_000,
    },
    {
      command: 'node e2e/serve.mjs',
      cwd: ROOT,
      url: `http://localhost:${WEB_PORT}/`,
      reuseExistingServer: false,
      env: { E2E_WEB_PORT: String(WEB_PORT), E2E_API_ORIGIN: `http://localhost:${API_PORT}` },
    },
  ],
});
