// D24 1.5단계 — Cloudflare Worker를 api 앞단 엣지 프록시로 세운다.
// 목적: Render 무료 티어의 스로틀링된 CPU에 요청이 닿기 *전에*, bcrypt가 걸리는
// 경로(로그인/회원가입/연동)만 골라 엣지에서 rate limit을 건다.
// 나머지 경로는 그대로 통과시켜 Render api(origin)로 프록시한다.
// 근거: docs/2.decisions/50_결정및이슈기록/2-1_기술결정사항.md D24,
//       docs/process/06_진행_로그.md §31~32.

export interface Env {
  // Render api 원본 주소. wrangler.jsonc의 vars에서 주입.
  API_ORIGIN: string;
  // Workers Rate Limiting 바인딩(2025-09-19 GA) — IP+경로 기준 카운팅은 Cloudflare가 대신 해준다.
  LOGIN_RATE_LIMITER: {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };
}

// bcrypt.compare/hash가 걸리는 CPU 바운드 경로만 골랐다 — 나머지(조회 등)는 원래도
// 가볍고(§31에서 MockDataService 인메모리 스캔 자체는 문제가 아니었음 확인됨) 막을 이유가 없다.
const RATE_LIMITED_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/members/register',
  '/api/v1/members/link',
]);

function rateLimitedResponse(): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: '요청이 너무 잦습니다. 잠시 후 다시 시도하세요.',
      },
    }),
    { status: 429, headers: { 'Content-Type': 'application/json' } },
  );
}

function upstreamErrorResponse(): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: { code: 'UPSTREAM_UNAVAILABLE', message: 'API 서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요.' },
    }),
    { status: 502, headers: { 'Content-Type': 'application/json' } },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (RATE_LIMITED_PATHS.has(url.pathname)) {
      // CF-Connecting-IP는 Cloudflare 네트워크를 지나는 모든 요청에 자동으로 붙는다
      // (workers.dev 포함, 커스텀 도메인 없이도 신뢰 가능한 클라이언트 IP).
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const { success } = await env.LOGIN_RATE_LIMITER.limit({ key: `${url.pathname}:${ip}` });
      if (!success) {
        return rateLimitedResponse();
      }
    }

    const originUrl = new URL(url.pathname + url.search, env.API_ORIGIN);
    // 메서드·헤더·바디를 그대로 승계해 원본 요청을 복제한다(표준 프록시 패턴).
    const proxyRequest = new Request(originUrl.toString(), request);

    try {
      return await fetch(proxyRequest);
    } catch {
      // Render 무료 티어 콜드스타트/스로틀링으로 origin이 아예 응답 못 하는 경우
      // Worker가 처리되지 않은 예외를 던지는 대신 이 앱의 공통 에러 포맷으로 응답한다.
      return upstreamErrorResponse();
    }
  },
};
