import { resolve } from 'node:path';

// Playwright가 설정·테스트를 CommonJS로 변환해 읽으므로 import.meta 대신 __dirname을 쓴다.
export const ROOT = resolve(__dirname, '..');

// 화면 테스트 전용 DB(D59). 기본값은 로컬·CI의 Postgres 계정과 같은 자격증명에 DB 이름만 다르다.
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  'postgresql://sports_erp:change-me-in-local-env@localhost:5432/sports_erp_e2e?schema=public';
export const API_PORT = Number(process.env.E2E_API_PORT ?? 3100);
export const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 4300);
