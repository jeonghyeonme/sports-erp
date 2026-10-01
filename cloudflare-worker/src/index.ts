// D24 1.5단계 — Cloudflare Worker를 api 앞단 엣지 프록시로 세운다.
// 목적: Render 무료 티어의 스로틀링된 CPU에 요청이 닿기 *전에*, bcrypt가 걸리는
// 경로(로그인/회원가입/연동)만 골라 엣지에서 rate limit을 건다.
// 나머지 /api/* 경로는 그대로 통과시켜 Render api(origin)로 프록시한다.
// 근거: docs/decisions/D24.md,
//       docs/log/031~032.
//
// D25 — admin-web(UI)은 wrangler.jsonc의 assets.run_worker_first가 "/api/*"로
// 한정돼 있어 이 스크립트를 거치지 않고 정적 자산 계층에서 바로 서빙된다.
// 그래서 이 파일은 여전히 /api/* 요청만 다루면 된다 — UI 폴백(env.ASSETS.fetch)을
// 따로 구현할 필요가 없다(Cloudflare 라우팅 계층이 이미 처리).
//
// D37 — origin을 Render에서 AWS Lambda(서울, Function URL)로 옮긴다. 이 Worker가 추가로 하는 일:
// ① Function URL은 공개 주소라 이 Worker의 rate limit을 건너뛰고 직접 부를 수 있다 — 비밀 헤더
//    (X-Origin-Secret)를 붙여 Lambda가 이 Worker를 거친 요청만 받게 한다(결정 4).
// ② Lambda가 동시 실행 상한(10)에 걸려 돌려주는 429를, 이 앱의 공통 에러 포맷(503 SERVER_BUSY +
//    Retry-After)으로 바꾼다 — 넘친 요청은 줄 세우지 않고 입구에서 빠르게 거절한다(결정 1).

export interface Env {
  // api 원본 주소(D37부터 Lambda Function URL). wrangler.jsonc의 vars에서 주입.
  API_ORIGIN: string;
  // D37 — Lambda와 공유하는 비밀값. `wrangler secret put ORIGIN_SECRET`으로 넣는다(저장소에 두지 않음).
  // 비어 있으면 헤더를 붙이지 않는다 — Render origin을 쓰던 과도기 호환.
  ORIGIN_SECRET?: string;
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

function serverBusyResponse(): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: { code: 'SERVER_BUSY', message: '요청이 몰려 지금은 처리할 수 없습니다. 잠시 후 다시 시도하세요.' },
    }),
    { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '2' } },
  );
}

// 앱이 스스로 내는 429(예: 회원 연동 시도 초과 LINK_ATTEMPTS_EXCEEDED)는 공통 포맷이라 그대로 통과시키고,
// 공통 포맷이 아닌 429(Lambda 동시 실행 상한 초과)만 SERVER_BUSY로 바꾼다.
async function isAppFormatted(response: Response): Promise<boolean> {
  try {
    const body = (await response.clone().json()) as { success?: unknown; error?: unknown };
    return body.success === false && typeof body.error === 'object' && body.error !== null;
  } catch {
    return false;
  }
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
    // 클라이언트가 보낸 같은 이름의 헤더는 덮어써서, 비밀값을 모르는 요청이 통과하지 못하게 한다.
    proxyRequest.headers.delete('X-Origin-Secret');
    if (env.ORIGIN_SECRET) proxyRequest.headers.set('X-Origin-Secret', env.ORIGIN_SECRET);

    try {
      const response = await fetch(proxyRequest);
      if (response.status === 429 && !(await isAppFormatted(response))) {
        return serverBusyResponse();
      }
      return response;
    } catch {
      // Render 무료 티어 콜드스타트/스로틀링으로 origin이 아예 응답 못 하는 경우
      // Worker가 처리되지 않은 예외를 던지는 대신 이 앱의 공통 에러 포맷으로 응답한다.
      return upstreamErrorResponse();
    }
  },
};
