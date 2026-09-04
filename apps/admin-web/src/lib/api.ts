import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1',
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
