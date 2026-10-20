// 화면 테스트용 정적 서버(D59) — 배포 Worker(cloudflare-worker)와 같은 규칙으로 빌드 결과를 준다.
// - /api/* → 로컬 api(E2E_API_ORIGIN, 기본 http://localhost:3100)로 그대로 넘긴다(같은 오리진 — 운영과 같다)
// - 실제 파일이 있으면 그 파일, 없으면 /m/* 는 회원 웹 index.html, 그 밖은 관리자 웹 index.html(SPA 폴백)
// 의존성 없이 node:http만 쓴다. 빌드(`npm run build:web`)가 먼저 있어야 한다.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { extname, join, normalize } from 'node:path';

const DIST = new URL('../apps/admin-web/dist/', import.meta.url).pathname;
const PORT = Number(process.env.E2E_WEB_PORT ?? 4300);
const API = new URL(process.env.E2E_API_ORIGIN ?? 'http://localhost:3100');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function sendFile(res, file) {
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    const proxied = httpRequest(
      { hostname: API.hostname, port: API.port, path: req.url, method: req.method, headers: { ...req.headers, host: API.host } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    proxied.on('error', () => {
      res.writeHead(502);
      res.end('api unreachable');
    });
    req.pipe(proxied);
    return;
  }
  const file = normalize(join(DIST, decodeURIComponent(url.pathname)));
  if (file.startsWith(DIST) && existsSync(file) && statSync(file).isFile()) return sendFile(res, file);
  const member = url.pathname === '/m' || url.pathname.startsWith('/m/');
  return sendFile(res, join(DIST, member ? 'm/index.html' : 'index.html'));
}).listen(PORT, () => console.log(`e2e web on :${PORT} → api ${API.origin}`));
