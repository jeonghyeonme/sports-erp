// 종합 발표 도식 — 캔버스 1000×700, scale 1로 배치되므로 글자는 처음부터 24px 이상.
// 도식 하나에 메시지 하나, 요소 6개 안팎(4-0 §4). 실제로 동작하는 것만 그린다.
const { txt, box, arrow, line, rect, svg } = require('./lib');

const B = (t, d, extra = {}) => [{ t, s: 28, w: 700 }, ...(d ? [{ t: d, s: 24, w: 400, c: 'ink' }] : [])].map((l) => ({ ...l, ...extra }));

// ── 사업 구조 순환: 계약(1번)이 운영(2번)의 전제, 운영 데이터가 다시 계약 근거로 ─────────
function bizCycle() {
  return svg('biz', 1000, 700, '본사가 위탁센터와 계약하고, 직원을 파견하고, 직원이 이용자에게 서비스하며, 운영 데이터가 다시 계약 근거로 돌아온다', () => {
    let s = box(20, 90, 400, 140, B('스포이즘 본사', '채용 · 계약 · 영업'), { kind: 'blue', sw: 2 });
    s += box(580, 90, 400, 140, B('위탁센터 = 지점', 'OO아파트와의 계약 현장'), { kind: 'blue', sw: 2 });
    s += box(580, 470, 400, 140, B('직원', '본사 채용 → 현장 파견'), { kind: 'plain', sw: 2 });
    s += box(20, 470, 400, 140, B('이용자(회원)', '등록 지점 프로그램 이용'), { kind: 'plain', sw: 2 });
    s += arrow([[420, 160], [580, 160]], { color: 'blue', sw: 2.5, label: { x: 500, y: 140, t: '① 계약', s: 24, w: 700 } });
    s += arrow([[780, 230], [780, 470]], { color: 'ink', sw: 2.5, label: { x: 796, y: 360, t: '② 파견', s: 24, a: 'start', w: 700 } });
    s += arrow([[580, 540], [420, 540]], { color: 'ink', sw: 2.5, label: { x: 500, y: 520, t: '③ 서비스', s: 24, w: 700 } });
    s += arrow([[220, 470], [220, 230]], { color: 'amber', sw: 2.5, dash: true, label: { x: 236, y: 340, t: '④ 운영 데이터가', s: 24, a: 'start', c: 'amber', w: 700 } });
    s += txt(236, 376, '계약 갱신·영업 근거로', { size: 24, w: 700, fill: 'amber' });
    s += txt(500, 672, '①이 ②③의 전제이고, ③의 데이터가 다시 ①로 돈다', { size: 24, w: 500, fill: 'muted', anchor: 'middle' });
    return s;
  });
}

// ── 회원 모바일 웹 대상 지점 수별 하루 API 요청 vs Workers 무료 한도 ─────────────
function memberAppBar() {
  return svg('mab', 1000, 700, '지점당 하루 100명 기준으로 98개 지점 전체는 하루 약 10.8만 건으로 무료 한도 10만 건을 넘고, 수도권 83개 지점은 약 9.3만 건으로 한도 안에 든다', () => {
    const base = 600, k = 4; // 1천 건 = 4px(1만 건 = 40px)
    let s = line(80, base, 960, base, { c: 'line', sw: 2 });
    s += rect(190, base - 108 * k, 240, 108 * k, { fill: 'amber', r: 4 });
    s += rect(570, base - 93 * k, 240, 93 * k, { fill: 'green', r: 4 });
    s += line(80, base - 100 * k, 960, base - 100 * k, { c: 'red', sw: 3, dash: true });
    s += txt(960, base - 100 * k - 14, '무료 한도 10만/일', { size: 26, w: 700, fill: 'red', anchor: 'end' });
    s += txt(310, base - 108 * k + 84, '약 10.8만', { size: 30, w: 800, fill: '#FFFFFF', anchor: 'middle' });
    s += txt(690, base - 93 * k + 84, '약 9.3만', { size: 30, w: 800, fill: '#FFFFFF', anchor: 'middle' });
    s += txt(310, base + 44, '98개 전체', { size: 26, w: 700, anchor: 'middle' });
    s += txt(690, base + 44, '수도권 83개', { size: 26, w: 700, anchor: 'middle' });
    s += txt(970, base + 90, '하루 API 요청 수(관리자 웹 약 1만 건 포함, 계산값)', { size: 24, fill: 'muted', anchor: 'end' });
    return s;
  });
}

// ── 핵심 엔티티 관계 — 31개 모델 중 6+1개 ─────────────────────────────────
function dataCore() {
  return svg('erd', 1000, 700, '지점은 계약이고, 직원은 파견 기록으로 지점에 연결되며, 회원·프로그램은 지점에 속하고 예약이 회원과 회차를 잇는다', () => {
    const W = 260, H = 110;
    let s = box(370, 70, W, H, B('지점 = 계약', '상대방·기간·상태'), { kind: 'blue', sw: 2.5 });
    s += box(20, 300, W, H, B('파견 기록', '언제·어느 현장'), { kind: 'amber', sw: 2 });
    s += box(370, 300, W, H, B('회원', '등록 지점 1곳'), { sw: 2 });
    s += box(720, 300, W, H, B('프로그램·회차', '지점 소속'), { sw: 2 });
    s += box(20, 530, W, H, B('직원', '본사 소속'), { sw: 2 });
    s += box(370, 530, W, H, B('계정', '로그인 · 역할 4개'), { kind: 'gray', sw: 2 });
    s += box(720, 530, W, H, B('예약·결제', '대기→승인→환불'), { sw: 2 });
    s += arrow([[370, 125], [150, 125], [150, 300]], { color: 'ink', noHead: true, sw: 2, label: { x: 260, y: 112, t: '어느 현장에', s: 24 } });
    s += arrow([[150, 530], [150, 410]], { color: 'ink', noHead: true, sw: 2, label: { x: 162, y: 478, t: '누가', s: 24, a: 'start' } });
    s += arrow([[500, 180], [500, 300]], { color: 'ink', noHead: true, sw: 2, label: { x: 512, y: 248, t: '등록 지점', s: 24, a: 'start' } });
    s += arrow([[630, 125], [850, 125], [850, 300]], { color: 'ink', noHead: true, sw: 2, label: { x: 740, y: 112, t: '지점 소속', s: 24 } });
    s += arrow([[850, 530], [850, 410]], { color: 'ink', noHead: true, sw: 2, label: { x: 862, y: 478, t: '회차', s: 24, a: 'start' } });
    s += arrow([[500, 530], [500, 410]], { color: 'gray', noHead: true, sw: 2, dash: true, label: { x: 512, y: 478, t: '1:1', s: 24, a: 'start', c: 'gray' } });
    s += arrow([[370, 585], [280, 585]], { color: 'gray', noHead: true, sw: 2, dash: true });
    s += arrow([[720, 560], [630, 400]], { color: 'ink', noHead: true, sw: 2, label: { x: 690, y: 500, t: '누가', s: 24 } });
    return s;
  });
}

// ── 시스템 구성: 운영 경로(실선) + Lambda 전환 경로(점선) ────────────────────
function sysArch() {
  return svg('arch', 1000, 700, '브라우저가 Cloudflare Worker를 거쳐 Lambda(서울)의 API와 Supabase(서울)로 간다. 이전 Render 경로는 더 쓰지 않는다', () => {
    let s = box(0, 120, 170, 140, B('브라우저', '관리자 웹'), { sw: 2 });
    s += box(230, 120, 240, 140, [{ t: 'Cloudflare', s: 26, w: 700 }, { t: 'Worker', s: 26, w: 700 }, { t: '화면 · 요청 제한', s: 24, w: 400, c: 'ink' }], { kind: 'blue', sw: 2 });
    s += box(530, 120, 220, 140, [{ t: 'AWS Lambda', s: 26, w: 700 }, { t: 'API (NestJS)', s: 24, w: 400, c: 'ink' }, { t: '서울', s: 24, w: 400, c: 'ink' }], { kind: 'green', sw: 2 });
    s += box(810, 120, 190, 140, [{ t: 'Supabase', s: 26, w: 700 }, { t: 'Postgres', s: 24, w: 400, c: 'ink' }, { t: '서울', s: 24, w: 400, c: 'ink' }], { kind: 'green', sw: 2 });
    s += box(530, 420, 220, 140, B('Render', '이전 경로'), { kind: 'gray', sw: 2, dash: true });
    s += arrow([[170, 190], [230, 190]], { color: 'ink', sw: 2.5 });
    s += arrow([[470, 190], [530, 190]], { color: 'ink', sw: 2.5 });
    s += arrow([[750, 190], [810, 190]], { color: 'ink', sw: 2.5 });
    s += arrow([[350, 260], [350, 490], [530, 490]], { color: 'gray', sw: 2, dash: true, noHead: true, label: { x: 362, y: 380, t: '전환 전 경로', s: 24, a: 'start', c: 'gray' } });
    s += txt(765, 310, '같은 서울 리전', { size: 24, w: 700, fill: 'green', anchor: 'middle' });
    s += txt(500, 650, '실선 = 지금 운영 경로   ·   회색 점선 = 전환 전에 쓰던 경로', { size: 24, w: 500, fill: 'muted', anchor: 'middle' });
    return s;
  });
}

// 세로 단계 + 오른쪽 거절 가지 공통 틀
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
  return gateFlow('iso', '요청은 로그인·역할·요청한 지점·꺼낸 데이터의 지점을 차례로 통과해야 처리되고, 하나라도 어긋나면 거절된다', [
    ['① 로그인했나', '토큰 검사', '401 거절'],
    ['② 이 기능을 쓸 역할인가', '본사 · 지점 · 직원 · 회원', '403 거절'],
    ['③ 요청한 지점이 내 지점인가', '경로·쿼리의 지점 ID (공통 가드)', '403 거절'],
    ['④ 꺼낸 데이터가 내 지점 것인가', '단건 조회는 컨트롤러가 직접 확인', '403 / 404'],
  ], '모두 통과 → 처리');
}

function reservationFlow() {
  return gateFlow('rsv', '회차를 잠근 뒤 지점·계약·정원을 확인하고, 유료면 결제 대기에서 승인될 때 확정된다', [
    ['① 회차를 잠근다', '동시에 온 요청은 줄을 선다', null, 'blue'],
    ['② 내 지점 프로그램인가', '다른 지점 회차는 예약 불가', '403 거절'],
    ['③ 계약이 종료된 지점인가', '종료 지점은 신규 예약 차단', '409 거절'],
    ['④ 정원·중복 예약', '정원 초과·같은 회차 중복 금지', '409 거절'],
    ['⑤ 유료면 신청 + 결제 대기', '무료 회차는 바로 확정', null],
  ], '⑥ 결제 승인(한 번만) → 확정');
}

// ── architecture-driver 방법론 (4주차 figs-44 그대로) ─────────────────────
function methodCycle() {
  return svg('m1', 1000, 700, 'Driver에서 대안·결정·구현·검증·기록까지 여섯 단계를 돌고, 기록이 다음 Driver로 다시 이어진다', () => {
    let s = txt(20, 44, '여섯 단계를 돌며 근거를 남긴다', { size: 28, w: 700 });
    const top = [
      { x: 20, t: 'Driver', d: '왜 바꾸나', k: 'blue' },
      { x: 340, t: '대안 비교', d: '장단점을 비교한다', k: 'plain' },
      { x: 660, t: '결정(ADR)', d: '근거를 문서로 남긴다', k: 'blue' },
    ];
    const bot = [
      { x: 20, t: '기록', d: '왜 맞았는지 남긴다', k: 'green' },
      { x: 340, t: '검증', d: '테스트로 확인한다', k: 'plain' },
      { x: 660, t: '구현', d: 'AI가 코드로 반영', k: 'green' },
    ];
    top.forEach((b) => { s += box(b.x, 90, 300, 140, [{ t: b.t, s: 28, w: 700 }, { t: b.d, s: 24, w: 400, c: 'ink' }], { kind: b.k, sw: 2 }); });
    bot.forEach((b) => { s += box(b.x, 470, 300, 140, [{ t: b.t, s: 28, w: 700 }, { t: b.d, s: 24, w: 400, c: 'ink' }], { kind: b.k, sw: 2 }); });
    s += arrow([[320, 160], [340, 160]], { color: 'ink', sw: 2.5 });
    s += arrow([[640, 160], [660, 160]], { color: 'ink', sw: 2.5 });
    s += arrow([[810, 230], [810, 470]], { color: 'ink', sw: 2.5, label: { x: 826, y: 350, t: '구현으로', s: 24, a: 'start' } });
    s += arrow([[660, 540], [640, 540]], { color: 'ink', sw: 2.5 });
    s += arrow([[340, 540], [320, 540]], { color: 'ink', sw: 2.5 });
    s += arrow([[170, 470], [170, 230]], { color: 'amber', sw: 2.5, dash: true, label: { x: 186, y: 350, t: '다음 사이클로', s: 24, a: 'start', c: 'amber' } });
    s += txt(970, 672, '사람은 Driver·결정을 승인하고, AI는 근거를 인용하며 구현한다', { size: 24, w: 500, fill: 'muted', anchor: 'end' });
    return s;
  });
}

// ── 문서 구조: 읽는 시점별 3계층(D38) ──────────────────────────────────────
function docTiers() {
  return svg('docs', 1000, 700, '매 세션 읽는 문서, 작업할 때 여는 문서, 왜를 따라갈 때만 여는 문서의 세 층으로 나뉜다', () => {
    const band = (y, t, c) => txt(0, y, t, { size: 26, w: 800, fill: c });
    let s = band(30, '① 매 세션 읽는다', 'blue');
    s += box(0, 50, 490, 120, B('CLAUDE.md', '지켜야 할 규칙 · 어디를 읽나'), { kind: 'blue', sw: 2 });
    s += box(510, 50, 490, 120, B('STATUS.md', '지금 상태 · 다음 할 일(80줄)'), { kind: 'blue', sw: 2 });
    s += band(262, '② 작업할 때 연다', 'ink');
    s += box(0, 282, 490, 120, B('도메인 문서 9개', '요약 카드 → 결정 → 부록'), { sw: 2 });
    s += box(510, 282, 490, 120, B('아키텍처 문서', '공유 엔티티 · 횡단 규칙'), { sw: 2 });
    s += band(494, "③ '왜?'를 따라갈 때만", 'gray');
    s += box(0, 514, 320, 120, B('결정 기록', '결정마다 파일 1개'), { kind: 'gray', sw: 2 });
    s += box(340, 514, 320, 120, B('진행 로그', '경위를 쌓기만'), { kind: 'gray', sw: 2 });
    s += box(680, 514, 320, 120, B('참고 자료', 'RFP · 요구사항 추적'), { kind: 'gray', sw: 2 });
    s += arrow([[500, 172], [500, 236]], { color: 'amber', sw: 2.5, dash: true, label: { x: 516, y: 214, t: '필요하면 더 깊이', s: 24, a: 'start', c: 'amber' } });
    s += arrow([[500, 404], [500, 468]], { color: 'amber', sw: 2.5, dash: true, label: { x: 516, y: 446, t: '필요하면 더 깊이', s: 24, a: 'start', c: 'amber' } });
    s += txt(500, 682, '문서 검사기가 링크·크기 상한·인덱스를 커밋 전에 검사', { size: 24, w: 500, fill: 'muted', anchor: 'middle' });
    return s;
  });
}

module.exports = { docTiers, bizCycle, memberAppBar, dataCore, sysArch, isolationFlow, reservationFlow, methodCycle };
