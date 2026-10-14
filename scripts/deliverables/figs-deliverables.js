// 산출물 전용 도식 — 발표 덱(figs-45.js, 4-5 종합발표 당시 기록)은 그대로 두고, 그 뒤 바뀐 두 장만 여기서 다시 그린다
// (사용자 결정 2026-10-14, log/111). 나머지 도식은 render_figs.js가 figs-45.js를 그대로 쓴다.
//   arch — 회원 모바일 웹(/m/) 추가, Render 이전 경로 제거, DB 접속 Session pooler(D49)
//   iso  — ④ 리소스 주인 확인을 컨트롤러가 아니라 전역 가드가 한다(D46)
const path = require('path');
const VIZ = path.resolve(__dirname, '../../docs/presentation/assets/4-5_종합발표/deck-source/viz');
const { txt, box, arrow, svg } = require(path.join(VIZ, 'lib'));

const B = (t, d) => [{ t, s: 28, w: 700 }, ...(d ? [{ t: d, s: 24, w: 400, c: 'ink' }] : [])];

function sysArch() {
  return svg('arch', 1000, 700, '관리자 웹과 회원 모바일 웹이 같은 Cloudflare Worker를 거쳐 Lambda(서울)의 API와 Supabase(서울)로 간다', () => {
    let s = box(0, 60, 170, 130, B('브라우저', '관리자 웹'), { sw: 2 });
    s += box(0, 300, 170, 130, B('휴대폰', '회원 웹 /m/'), { sw: 2 });
    s += box(230, 150, 240, 190, [{ t: 'Cloudflare', s: 26, w: 700 }, { t: 'Worker', s: 26, w: 700 }, { t: '화면 2종 ·', s: 24, w: 400, c: 'ink' }, { t: '요청 제한', s: 24, w: 400, c: 'ink' }], { kind: 'blue', sw: 2 });
    s += box(530, 175, 220, 140, [{ t: 'AWS Lambda', s: 26, w: 700 }, { t: 'API (NestJS)', s: 24, w: 400, c: 'ink' }, { t: '상한 10', s: 24, w: 400, c: 'ink' }], { kind: 'green', sw: 2 });
    s += box(810, 175, 190, 140, [{ t: 'Supabase', s: 26, w: 700 }, { t: 'Postgres', s: 24, w: 400, c: 'ink' }, { t: '서울', s: 24, w: 400, c: 'ink' }], { kind: 'green', sw: 2 });
    s += arrow([[170, 125], [200, 125], [200, 210], [230, 210]], { color: 'ink', sw: 2.5 });
    s += arrow([[170, 365], [200, 365], [200, 280], [230, 280]], { color: 'ink', sw: 2.5 });
    s += arrow([[470, 245], [530, 245]], { color: 'ink', sw: 2.5 });
    s += arrow([[750, 245], [810, 245]], { color: 'ink', sw: 2.5 });
    s += txt(780, 370, 'Session pooler · 같은 서울 리전', { size: 24, w: 700, fill: 'green', anchor: 'middle' });
    s += txt(500, 560, '실행 환경 하나 = DB 연결 하나 (상한 10, Pool Size 15)', { size: 24, w: 500, fill: 'muted', anchor: 'middle' });
    s += txt(500, 640, '넘친 요청은 입구에서 바로 503 · 2초 뒤 재시도', { size: 24, w: 500, fill: 'muted', anchor: 'middle' });
    return s;
  });
}

// figs-45.js의 gateFlow와 같은 틀(그쪽이 export하지 않아 옮겨 왔다 — 발표자료는 고치지 않는다)
function gateFlow(id, claim, steps, pass) {
  return svg(id, 1000, 700, claim, () => {
    let s = '';
    const n = steps.length, h = 86, gap = (600 - n * h) / n;
    steps.forEach((st, i) => {
      const y = 10 + i * (h + gap);
      s += box(20, y, 600, h, [{ t: st[0], s: 26, w: 700 }, { t: st[1], s: 24, w: 400, c: 'ink' }], { kind: st[3] || 'plain', sw: 2, left: true });
      if (st[2]) {
        s += box(740, y + 13, 240, 60, [{ t: st[2], s: 26, w: 700 }], { kind: 'red', sw: 2 });
        s += arrow([[620, y + h / 2], [740, y + h / 2]], { color: 'red', sw: 2.2, label: { x: 680, y: y + h / 2 - 12, t: '아니면', s: 24, c: 'red' } });
      }
      const next = i < n - 1 ? 10 + (i + 1) * (h + gap) : 10 + n * (h + gap);
      s += arrow([[160, y + h], [160, next]], { color: 'ink', sw: 2.2 });
    });
    const py = 10 + n * (h + gap);
    s += box(20, py, 600, 80, [{ t: pass, s: 26, w: 700 }], { kind: 'green', sw: 2 });
    return s;
  });
}

function isolationFlow() {
  return gateFlow('iso', '요청은 로그인·역할·요청한 지점·다루는 데이터의 지점을 차례로 통과해야 처리되고, 하나라도 어긋나면 거절된다', [
    ['① 로그인했나', '토큰 검사', '401 거절'],
    ['② 이 기능을 쓸 역할인가', '본사 · 지점 · 직원 · 회원', '403 거절'],
    ['③ 요청한 지점이 내 지점인가', '경로·쿼리의 지점 ID (전역 가드)', '403 거절'],
    ['④ 다루는 데이터가 내 지점 것인가', '라우트가 선언한 리소스의 주인 (전역 가드)', '403 / 404'],
  ], '모두 통과 → 처리');
}

module.exports = { sysArch, isolationFlow };
