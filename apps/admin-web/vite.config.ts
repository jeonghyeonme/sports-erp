import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// log/036·144 — 프로덕션 빌드에 로컬 api 주소가 들어가면 배포 화면이 사용자의 PC(localhost)로 요청을 보내
// 로그인부터 실패한다. `.env`·`.env.local`·`.env.production*`은 vite build도 읽으므로(.env.example을 .env로 복사하면
// 그대로 박힌다) 빌드 단계에서 막는다. 로컬 개발 주소는 `.env.development`(dev 서버에서만 읽힘)에 둔다.
export default defineConfig(({ mode }) => {
  const apiBase = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL ?? '';
  if (mode === 'production' && /localhost|127\.0\.0\.1/.test(apiBase)) {
    throw new Error(
      `프로덕션 빌드에 로컬 api 주소(VITE_API_BASE_URL=${apiBase})가 들어간다 — apps/admin-web의 .env·.env.local·.env.production* 에서 VITE_API_BASE_URL을 지울 것(로컬 개발은 .env.development)`,
    );
  }
  return {
    plugins: [react()],
    server: { port: 5173 },
  };
});
