import axios from 'axios';

// 로컬 개발은 .env의 VITE_API_BASE_URL(http://localhost:3000/api/v1)이 우선 적용된다.
// 프로덕션 빌드는 값을 비워 상대경로 폴백을 쓴다 — admin-web이 Cloudflare Worker의
// 정적 자산으로 서빙되고 /api/*는 같은 Worker가 처리하므로(D25) UI와 API가 동일
// 오리진이라 상대경로만으로 충분하고, 이러면 CORS가 아예 성립하지 않는다.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
});

// 01문서 §3.2: Access Token은 클라이언트 메모리에만 둔다(localStorage 미사용) —
// 데모 단계라 새로고침하면 로그아웃되지만, 실제 보안 원칙을 그대로 반영한다.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});
