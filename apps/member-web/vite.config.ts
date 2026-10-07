import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// D41 — 회원 웹은 같은 Worker의 /m/ 아래에서 서빙된다. 빌드 결과를 admin-web dist의 m/에 써서
// Worker의 정적 자산 폴더 하나에 합친다(admin-web을 먼저 빌드해야 한다 — 그 빌드가 dist를 비운다).
// 개발 서버는 .env 대신 프록시로 로컬 api(localhost:3000)에 붙는다 — 프로덕션과 같은 상대경로 /api/v1을 쓴다.
export default defineConfig({
  base: '/m/',
  plugins: [react()],
  build: {
    outDir: '../admin-web/dist/m',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
