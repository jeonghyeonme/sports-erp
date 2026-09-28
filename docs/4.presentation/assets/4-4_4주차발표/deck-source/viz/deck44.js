// 4주차 발표 덱 — "기능은 다 됐다. 이번 주는 실제로 띄우다 만난 진짜 문제를 실측하고, 구조를 고치는 방향을 정했다"
// 흐름: 표지 → 요약 → (Part A 도메인 사이클) → (Part B 배포·병목·구조개선) → (Part C 근본 해결 방향) → 라이브 데모 → 마무리
// 디자인: 3주차 발표자료 언어 그대로 — 웜 그레이 + 네이비 + 앰버 / Gothic A1 · Noto Sans KR · JetBrains Mono
const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const F = require('./figs-44');
lib.setMode('slide');

const OUT = process.argv[2];
const BODY = "'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";
const DISPLAY = "'Gothic A1', 'Noto Sans KR', 'Malgun Gothic', sans-serif";
const MONO = "'JetBrains Mono', 'Noto Sans KR', Consolas, monospace";
const BG = '#F4F5F3', SURFACE = '#FFFFFF', SURFACE2 = '#EBEEEC', INK = '#14191C', SOFT = '#4B5563';
const LINE = '#E1E4E1', LINE_STRONG = '#CBD0CD';
const NAVY = '#1E3A5F', NAVY_SOFT = '#E7ECF1', AMBER = '#9A5A0C', AMBER_SOFT = '#FBEEDD';
const GREEN = '#187650', GREEN_SOFT = '#E3F3EB', GRAY = '#5B6470', GRAY_SOFT = '#EDEFEE';
const RED = '#B3261E', RED_SOFT = '#F8E6E4';
const SHADOW = '0 1px 2px rgba(20,25,28,0.05), 0 14px 32px -18px rgba(20,25,28,0.28)';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const slides = [];
const order = [];
function section(id, { bg = BG, ink = INK, pad = '72px 96px 120px', gap = 16, notes = '' }, inner) {
  const aside = notes ? `<aside>${esc(notes)}</aside>` : '';
  slides.push({ id, html: `<section id="${id}" data-transition="fade" style="background:${bg}; color:${ink}; font-family:${BODY}; padding:${pad}; display:flex; flex-direction:column; gap:${gap}px">${inner}${aside}</section>` });
  order.push(id);
}
const eyebrow = (t) => `<p style="font-family:${MONO}; font-size:24px; font-weight:600; letter-spacing:3px; color:${NAVY}">${t}</p>`;
const title = (t) => `<h2 style="font-family:${DISPLAY}; font-size:60px; font-weight:700; line-height:1.15; letter-spacing:-1px; color:${INK}">${t}</h2>`;
const head = (e, t) => eyebrow(e) + title(t);
const foot = (t) => `<p style="position:absolute; left:96px; bottom:40px; width:1728px; font-size:24px; color:${SOFT}">${t}</p>`;
const fill = (inner, extra = '') => `<div style="flex:1; display:flex; flex-direction:column; justify-content:center; ${extra}">${inner}</div>`;
const card = (inner, extra = '') => `<div style="display:flex; flex-direction:column; gap:16px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; padding:40px; box-shadow:${SHADOW}; ${extra}">${inner}</div>`;
const pill = (t, bg, color, extra = '') => `<p style="font-family:${MONO}; font-size:24px; font-weight:600; color:${color}; background:${bg}; border-radius:999px; padding:4px 18px; ${extra}">${t}</p>`;
const label = (t) => `<p style="font-family:${MONO}; font-size:24px; font-weight:600; letter-spacing:2px; color:${NAVY}">${t}</p>`;
const check = `<x-icon name="Check" style="color:${GREEN}; width:30px; height:30px"></x-icon>`;
const sbullets = (arr) => `<div style="display:flex; flex-direction:column; gap:12px">${arr.map((t) => `<div style="display:flex; align-items:flex-start; gap:14px">${check}<p style="font-size:28px; line-height:1.4; color:${INK}">${t}</p></div>`).join('')}</div>`;

function dots(cx, cy, rx, ry, gap = 40) {
  const g = { a: [], b: [], c: [] };
  for (let x = gap / 2; x < 1920; x += gap) for (let y = gap / 2; y < 1080; y += gap) {
    const t = Math.hypot((x - cx) / rx, (y - cy) / ry);
    if (t < 1) g[t < 0.4 ? 'a' : t < 0.7 ? 'b' : 'c'].push(`<circle cx="${x}" cy="${y}" r="2.4"/>`);
  }
  const grp = (k, o) => `<g fill="${LINE_STRONG}" fill-opacity="${o}">${g[k].join('')}</g>`;
  return `<svg aria-label="장식용 점 격자" viewBox="0 0 1920 1080" width="1920" height="1080" style="position:absolute; left:0px; top:0px; width:1920px; height:1080px">${grp('c', 0.22)}${grp('b', 0.4)}${grp('a', 0.62)}</svg>`;
}

// 전체 폭 도식 카드 — 1000×700 도식을 1728×780 카드 안에 스케일 1로 중앙 배치
function diagramCard(build) {
  lib.setSlide({ left: 460, top: 252, scale: 1 });
  const frag = build();
  const box = `<div style="position:absolute; left:96px; top:212px; width:1728px; height:780px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; box-shadow:${SHADOW}"></div>`;
  return box + frag;
}

const td = (t) => `<td style="text-align:left">${t}</td>`;
const tableCard = (inner) => `<div style="background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; padding:20px 32px; box-shadow:${SHADOW}">${inner}</div>`;
const table = (size, colsPct, headers, rows) =>
  `<table style="font-size:${size}px; color:${INK}; font-family:${BODY}"><tr>${headers.map((h, i) => `<th style="width:${colsPct[i]}%; text-align:left; color:${SOFT}">${h}</th>`).join('')}</tr>${rows.map((r) => `<tr style="background:${SURFACE}">${r.join('')}</tr>`).join('')}</table>`;

const optChip = (name, note, chosen) => {
  const bg = chosen ? GREEN_SOFT : GRAY_SOFT;
  const c = chosen ? GREEN : GRAY;
  return `<div style="flex:1; display:flex; flex-direction:column; gap:10px; background:${bg}; border:1px solid ${c}; border-radius:12px; padding:24px 22px"><p style="font-family:${MONO}; font-size:24px; font-weight:700; color:${c}">${chosen ? '채택' : '기각'}</p><p style="font-size:27px; font-weight:700; line-height:1.3; color:${INK}">${name}</p><p style="font-size:24px; line-height:1.35; color:${SOFT}">${note}</p></div>`;
};
const causeLine = (t) => `<div style="display:flex; flex-direction:column; gap:10px"><p style="font-family:${MONO}; font-size:24px; font-weight:600; letter-spacing:2px; color:${NAVY}">원인</p><p style="font-size:32px; font-weight:600; line-height:1.4; color:${INK}">${t}</p></div>`;
const adoptedCard = (t) => `<div style="display:flex; flex-direction:column; gap:12px; background:${GREEN_SOFT}; border:1px solid ${GREEN}; border-radius:14px; padding:32px"><p style="font-family:${MONO}; font-size:24px; font-weight:700; letter-spacing:2px; color:${GREEN}">채택 이유</p><p style="font-size:30px; font-weight:600; line-height:1.4; color:${INK}">${t}</p></div>`;
function decisionSlide(id, adrLabel, ttl, cause, opts, adopted, footText, notes) {
  section(id, { notes },
    head(adrLabel, ttl) +
    fill(`<div style="display:flex; flex-direction:column; gap:26px">` +
      causeLine(cause) +
      `<div style="display:flex; gap:18px">${opts.map((o) => optChip(o[0], o[1], o[2])).join('')}</div>` +
      adoptedCard(adopted) +
      `</div>`) +
    foot(footText));
}

const ph = (id, name, w, status, kind) => {
  const bg = kind === 'done' ? GREEN_SOFT : kind === 'part' ? AMBER_SOFT : kind === 'plan' ? NAVY_SOFT : GRAY_SOFT;
  const c = kind === 'done' ? GREEN : kind === 'part' ? AMBER : kind === 'plan' ? NAVY : GRAY;
  return `<div style="flex:${w}; display:flex; flex-direction:column; align-items:flex-start; gap:10px; padding:22px 14px; background:${bg}; border:1px solid ${c}; border-radius:14px"><p style="font-family:${MONO}; font-size:24px; font-weight:700; color:${c}">${id}</p><p style="font-size:28px; font-weight:700; line-height:1.3; color:${INK}">${name}</p><div style="flex:1"></div><p style="font-family:${MONO}; font-size:24px; font-weight:600; color:${c}; background:${SURFACE}; border-radius:999px; padding:2px 12px">${status}</p></div>`;
};

// ── 1 표지 ────────────────────────────────────────────────────────────────
section('cover', { pad: '128px 176px', gap: 20, notes: '4주차 진행상황 발표(15분). 시간 배분: 도입 1분 · Part A 도메인 사이클 3분 · Part B 배포·병목 6분 · Part C 방향 3분 · 마무리(라이브 데모 포함) 2분. 이번 주는 신규 UI가 거의 없어 도메인별 화면 시연 대신 인프라 흐름 중심으로 구성했다.' },
  dots(1500, 430, 780, 520) +
  `<div style="flex:1"></div>` +
  `<div style="display:flex"><p style="font-family:${MONO}; font-size:24px; letter-spacing:2px; color:${NAVY}; background:${NAVY_SOFT}; border:1px solid ${LINE}; border-radius:999px; padding:8px 24px">SPOISM ERP · PROGRESS REPORT</p></div>` +
  `<h1 style="font-family:${DISPLAY}; font-size:176px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:${INK}">스포이즘 ERP</h1>` +
  `<p style="font-size:52px; font-weight:500; color:${SOFT}">4주차 진행상황 발표</p>` +
  `<div style="height:36px"></div>` +
  `<p style="font-family:${MONO}; font-size:28px; color:${SOFT}"><b>발표자</b>&nbsp; 박정현 &nbsp;&nbsp;·&nbsp;&nbsp; <b>준비일</b>&nbsp; 2026-09-28 &nbsp;&nbsp;·&nbsp;&nbsp; <b>대상</b>&nbsp; 아파트·오피스텔 커뮤니티 시설 위탁운영 ERP</p>` +
  `<div style="flex:1"></div>`);

// ── 2 요약 ───────────────────────────────────────────────────────────────
const scard = (name, desc, status, kind) => {
  const bg = kind === 'green' ? GREEN_SOFT : kind === 'navy' ? NAVY_SOFT : AMBER_SOFT;
  const c = kind === 'green' ? GREEN : kind === 'navy' ? NAVY : AMBER;
  return card(`<h3 style="font-family:${DISPLAY}; font-size:40px; font-weight:700; line-height:1.2; color:${INK}">${name}</h3><p style="font-size:28px; line-height:1.5; color:${SOFT}">${desc}</p><div style="flex:1"></div><div style="display:flex">${pill(status, bg, c)}</div>`, 'flex:1');
};
section('summary', { notes: '이번 주는 화면 기준 진행이 더뎌 보일 수 있다. 하지만 이번 주가 답한 질문은 "느낌"이 아니라 "숫자"였다 — 실제로 배포하고, 실제로 부하를 걸어보고, 그 결과가 가리키는 구조적 원인까지 고치기 시작했다는 걸 이 발표에서 보여준다.' },
  head('오늘 발표, 한 줄 요약', '띄워보고, 재보고, 고쳤습니다') +
  fill(`<div style="display:flex; align-items:stretch; gap:20px">` +
    scard('도메인 사이클', '9개 도메인을 방법론대로 다시 훑어 실제 버그 5건을 찾아 고쳤습니다.', '완료', 'green') +
    scard('실제 배포', 'admin-web·api·DB를 처음으로 인터넷에 띄웠습니다.', '완료', 'green') +
    scard('병목 실측', '부하테스트로 "동시 로그인에 15초"라는 숫자를 확인했습니다.', '실측 완료', 'navy') +
    scard('구조적 해결', '근본 원인(인메모리 상태)을 없애는 전환에 착수했습니다.', '진행 중', 'amber') +
    `</div>`) +
  `<p style="font-size:32px; font-weight:600; color:${INK}">화면은 조용했지만, 방향은 숫자로 정했습니다</p>`);

// ── 3 방법론 (Part A) ───────────────────────────────────────────────────
section('cycle-method', { notes: 'Part A 시작(3분). architecture-driver 방법론: 왜 바꾸는지(Driver)를 먼저 밝히고, 대안과 트레이드오프를 비교해 결정을 ADR로 남긴 뒤 구현하고, 실제로 검증하고, 왜 맞는 선택이었는지 기록한다. 기록이 다음 사이클의 Driver로 이어진다. 이 방법론은 이 프로젝트(근태관리 도메인 사이클)에서 먼저 확립됐고, 범용 스킬로 역이식돼 CLAUDE.md에 원칙으로 박혀 있다.' },
  head('Part A · 도메인 사이클', '9개 도메인을 방법론대로 다시 훑었습니다') +
  diagramCard(F.methodCycle));

// ── 4 실제로 찾은 버그 5건 ────────────────────────────────────────────────
section('cycle-bugs', { notes: '이 방법론이 실제로 작동했다는 증거. 사이클을 돌며 이미 정했던 불변식(지점 격리, 계약 종료 지점 차단)이 새 라우트에서 빠져 있던 걸 5건 찾았다. 전부 "고쳤다"로 끝나지 않고 ADR 문서로 왜 그게 맞는 판단인지 남겼다. 질문이 나오면: 이 버그들은 자동 테스트가 잡은 게 아니라 사이클을 돌며 코드를 다시 읽다가 발견한 것도 있고, 통합 테스트로 확인한 것도 있다(도메인마다 다름) — 과장하지 말 것.' },
  head('Part A · 도메인 사이클', '이 방법론이 실제 버그 5건을 찾았습니다') +
  fill(tableCard(table(28, [16, 40, 44], ['근거', '무엇이 빠져 있었나', '고친 것'], [
    [td('ADR-FAC-03'), td('계약이 종료된 지점에서도 시설을 새로 등록하거나 혼잡도를 보정할 수 있었다'), td('계약종료 지점 차단 규칙을 시설 등록·보정에도 적용')],
    [td('ADR-BRD-01'), td('특정 지점 대상 본사 공지가 그 지점 <b>회원</b>에게도 노출되고 있었다'), td('회원에게는 전체 공지만 보이도록 열람 범위 수정')],
    [td('ADR-PRG-01'), td('유료 회차를 등록할 때 정원(capacity) 검증이 빠져 있었다'), td('등록 시 정원 필수 검증 추가')],
    [td('ADR-RES-01'), td('계약이 종료된 지점에서도 자산 등록·문서 업로드가 가능했다'), td('계약종료 지점 차단 규칙 적용')],
    [td('ADR-PRG-03'), td('프로그램에 다른 지점의 시설을 연결할 수 있었다'), td('지점 일치 검증 추가')],
  ]))) +
  foot('공통점 — 전부 "지점 데이터 격리"·"계약 종료 지점 차단" 불변식이 새 라우트에서 빠졌던 패턴'));

// ── 5 이번 주 사이클 숫자 ─────────────────────────────────────────────────
const bignum = (n, l, kind) => {
  const c = kind === 'green' ? GREEN : kind === 'navy' ? NAVY : AMBER;
  const bg = kind === 'green' ? GREEN_SOFT : kind === 'navy' ? NAVY_SOFT : AMBER_SOFT;
  return `<div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:12px; background:${bg}; border:1px solid ${c}; border-radius:14px; padding:44px 20px"><p style="font-family:${MONO}; font-size:76px; font-weight:700; color:${c}">${n}</p><p style="font-size:28px; font-weight:600; color:${INK}; text-align:center">${l}</p></div>`;
};
section('cycle-momentum', { notes: '숫자는 이번 발표 준비 시점에 git log로 직접 세었다(범위: 3fa3a65~638b8bd). 회원관리 사이클은 버그 수정을 넘어 신규 기능 2개(오프라인↔앱 연동, 앱 자체 회원가입)를 얻었다 — 이건 다음 단계인 회원 앱(React Native) 착수를 위한 선행 작업이라는 점을 강조. "9개 도메인 전체 사이클 완료"는 이번 주가 아니라 3주에 걸쳐 누적된 것이고, 이번 주는 그중 6개 도메인을 다시 훑은 구간이라는 걸 명확히 한다.' },
  head('Part A · 도메인 사이클', '숫자로 보는 이번 주') +
  fill(`<div style="display:flex; gap:20px">${bignum('6', '도메인 재검토\n(근태·혼잡도·프로그램·게시판·자원문서관리·회원관리)', 'navy')}${bignum('16', 'ADR로 남긴 결정', 'green')}${bignum('27', '커밋', 'amber')}</div>`) +
  card(`<p style="font-family:${MONO}; font-size:24px; font-weight:600; letter-spacing:2px; color:${NAVY}">덤으로 얻은 것</p><p style="font-size:32px; font-weight:600; line-height:1.4; color:${INK}">회원관리 사이클에서 신규 기능 2개를 얻었습니다 — 오프라인↔앱 연동, 앱 자체 회원가입. 다음 단계(회원 앱 착수)의 선행 작업입니다.</p>`) +
  foot('git log 3fa3a65..638b8bd 기준, 2026-09-28 재실측'));

// ── 6 결정 1 — D23 배포 ──────────────────────────────────────────────────
const flowBox = (t, d, k) => {
  const bg = k === 'navy' ? NAVY_SOFT : k === 'green' ? GREEN_SOFT : SURFACE;
  const c = k === 'navy' ? NAVY : k === 'green' ? GREEN : LINE_STRONG;
  return `<div style="flex:1; display:flex; flex-direction:column; gap:10px; background:${bg}; border:1px solid ${c}; border-radius:14px; padding:32px; box-shadow:${SHADOW}"><h3 style="font-family:${DISPLAY}; font-size:36px; font-weight:700; color:${INK}">${t}</h3><p style="font-size:26px; line-height:1.4; color:${SOFT}">${d}</p></div>`;
};
const bigArrow = `<div style="display:flex; align-items:center"><p style="font-size:56px; font-weight:700; color:${NAVY}">→</p></div>`;
decisionSlide('deploy', 'D23 · 결정 1', '가볍게 Render 하나로 시작했습니다',
  '정적 페이지(admin-web)와 API를 유지비 없이 빠르게 인터넷에 띄워야 했다',
  [
    ['Cloudflare Pages (원안)', 'Cloudflare MCP 커넥터에 Pages를 만드는 툴이 없어 배포 자체가 불가능했다', false],
    ['Vercel 등 서버리스', 'NestJS는 상시구동 모델이라 서버리스 어댑터가 필요해 가장 가볍다는 기준에 안 맞았다', false],
    ['Railway', '가입 시 1회성 크레딧만 주고 이후 과금 — 무료 유지 조건에서 탈락', false],
    ['Render', '무료 + GitHub 자동배포 + npm workspaces 빌드 그대로 재사용 가능', true],
  ],
  'admin-web·api 둘 다 Render 하나로 통합 — 카드 등록 없이 무료, push마다 자동 재배포. DB는 Supabase로 별도 결정(스키마만 배포, 앱 연결은 아직)',
  'D23 · 세 서비스 모두 GitHub 연동 자동배포, 전부 무료 티어 — 이 배포가 있었기에 다음 부하테스트가 가능했다',
  '결정 1(D23). 원래 admin-web은 Cloudflare Pages 계획이었는데, MCP 커넥터에 Pages 생성 툴이 없어 Render로 조정했다 — "이론적으로 나은 것"이 아니라 "지금 가진 도구로 실제로 무엇을 만들 수 있는가"로 판단한 사례. DB(Supabase)는 이 시점엔 스키마만 배포했고 앱 연결은 D26에서 시작했다. 질문 대비 — Cloudflare Worker와 Pages는 다른 제품이다(뒤 슬라이드에서 Worker가 나오면 설명): Worker는 나중에 D24에서 rate limit 때문에 따로 세운 것이고, 지금은 admin-web도 그 Worker의 정적 자산(Static Assets)으로 흡수돼 있어 Pages는 결국 한 번도 쓴 적이 없다.');

// ── 7 왜 부하테스트를 했나 ────────────────────────────────────────────────
section('loadtest-setup', { notes: '"느릴 것 같다"는 추측 대신 k6로 실측했다. 시나리오는 두 가지 — 로그인 0~40명 램핑(bcrypt가 CPU 바운드라 먼저 무너질 지점), 조회 0~100명 램핑(인메모리라 원래 빠름). 위탁계약이 이미 98개라는 사실을 근거로 "몇 명 안 되는데 문제 생기겠어?"라는 반박을 미리 막는다.' },
  head('D24 · 원인 파악', '왜 부하테스트를 했나') +
  fill(card(`<p style="font-size:34px; font-weight:600; line-height:1.5; color:${INK}">"무료 인프라니까 느릴 수도 있다"는 <b style="color:${AMBER}">추측</b>으로 남겨두지 않고, k6로 <b style="color:${NAVY}">실측</b>했습니다.</p>`) +
    `<div style="height:24px"></div>` +
    `<div style="display:flex; gap:20px">` +
    flowBox('로그인 0~40명', 'bcrypt.compare가 CPU 바운드 — 무료 티어 공유 CPU에서 먼저 무너질 가능성이 높은 지점', 'plain') +
    flowBox('조회 0~100명', '인메모리 스캔이라 원래 빠름 — 여기서도 느려지면 이벤트루프 자체가 막힌 것', 'plain') +
    `</div>`) +
  foot('이미 위탁계약이 98개다 — "몇 명 안 되는데" 라는 가정은 검증이 필요했다'));

// ── 8 실측 결과 ───────────────────────────────────────────────────────────
const chip = (t, k) => {
  const bg = k === 'red' ? RED_SOFT : k === 'amber' ? AMBER_SOFT : GRAY_SOFT;
  const c = k === 'red' ? RED : k === 'amber' ? AMBER : GRAY;
  return `<p style="font-family:${MONO}; font-size:26px; font-weight:700; color:${c}; background:${bg}; border:1px solid ${c}; border-radius:999px; padding:10px 26px">${t}</p>`;
};
section('loadtest-numbers', { notes: '핵심 숫자(시간을 더 쓴다). 로컬 65ms vs Render 무료 티어 로그인 p95 15.16초 — 233배. 40명 램핑 중 응답시간이 완만히 늘지 않고 급격히 무너진 패턴(7.4s→15.16s→17.11s)을 3개 칩으로 보여준다. "코드 문제가 아니라 무료 티어 공유 CPU 스로틀링"이 핵심 메시지. 질문 대비: 이 세션에서는 egress 정책상 재현 불가, 수치는 사용자가 외부에서 실행한 실측값이고 design-constants.md에 계산 근거가 있다.' },
  head('D24 · 원인 파악', '동시 로그인 40명에 15초가 걸렸습니다') +
  fill(`<div style="display:flex; gap:20px">${bignum('65ms', '정상 처리\n(로컬)', 'green')}${bignum('15.16초', 'Render 무료 티어\n로그인 p95', 'amber')}</div>`) +
  card(`<p style="font-family:${MONO}; font-size:24px; font-weight:600; letter-spacing:2px; color:${NAVY}">40명 램핑 중 무너진 패턴</p><div style="display:flex; align-items:center; gap:20px">${chip('7.4초', 'gray')}<p style="font-size:32px; color:${SOFT}">→</p>${chip('15.16초', 'amber')}<p style="font-size:32px; color:${SOFT}">→</p>${chip('17.11초', 'red')}<p style="font-size:28px; color:${SOFT}; margin-left:12px">완만히 늘지 않고 급격히 무너졌다</p></div>`) +
  foot('2026-09-27 k6 실측 · 코드 문제가 아니라 Render 무료 티어 공유 CPU 스로틀링'));

// ── 9 왜 이렇게 되는가 ────────────────────────────────────────────────────
section('bottleneck', { notes: "Little's Law로 설명되는 자기강화 루프. 지연이 발생하면 동시 진행 건수(L=λW)가 늘고, 늘어난 요청이 CPU 경합을 심화시키고, 그게 다시 처리시간을 늘려 루프가 증폭된다. 정상 처리(65ms) 시 동시 진행 로그인은 0.12건이라 평소엔 전혀 문제가 안 되지만, 15.16초로 늘어나는 순간 같은 공식이 28.5건으로 밀어올린다. 3년 후(98→130개 지점) 추정으로는 장애 상황 동시 진행이 38.4건까지 간다." },
  head('D24 · 원인 파악', '왜 이렇게 되는가 — 자기강화 루프') +
  diagramCard(F.bottleneckLoop) +
  foot("design-constants.md ⑦~⑨ · Little's Law 역산 — 3년 후 추정 시 장애 상황 동시 진행 로그인 ≈38.4건"));

// ── 10 결정 2 — D24 엣지 rate limit ───────────────────────────────────────
decisionSlide('edge-fix', 'D24 · 결정 2', '몰랐던 인프라를 찾아 막았습니다',
  '부하테스트로 확인된 CPU 스로틀링 — 느린 CPU에 요청이 아예 닿지 못하게 걸러야 했다',
  [
    ['앱 레벨 rate limit', 'NestJS 안에서 막으면 이미 CPU를 쓴 뒤에 거부돼 효과가 약함', false],
    ['bcrypt cost 하향', '보안 여유를 대가로 임계점만 뒤로 미루는 임시방편', false],
    ['Render 유료 플랜', '비용 발생, 근본 해결도 아니라서 나중 단계로 미룸', false],
    ['Cloudflare Worker 엣지 rate limit', '커스텀 도메인 없이도 workers.dev로 바로 가능하다는 걸 새로 발견', true],
  ],
  '엣지에서 걸러야 Render CPU에 아예 안 닿는다 — 단, 근본 해결책은 아니다(정상적인 동시 접속 폭주는 여전히 그대로 느림)',
  'D24 · 2026-09-27 배포 완료 — Workers Rate Limiting 바인딩(2025-09-19 GA)도 Zone(도메인) 없이 Worker 단독으로 동작한다',
  '결정 2(D24). "커스텀 도메인이 있어야 Cloudflare 방어선을 쓸 수 있다"고 처음엔 잘못 판단했다가, workers.dev 서브도메인만으로 Worker와 Rate Limiting 바인딩 둘 다 된다는 걸 같은 날 재확인했다 — 몰랐던 인프라를 찾아낸 순간. 보안 대책(rate limit)과 용량 대책(수평 확장)을 뒤섞지 않고 분리한 게 이 결정의 핵심이라는 것도 강조. 질문 대비(D25, 슬라이드엔 안 넣음) — 이 Worker를 세우면서 admin-web(Render)과 오리진이 갈라져 로그인 실패·새로고침 404가 잠깐 났었는데, admin-web을 같은 Worker의 정적 자산으로 흡수해 해결했다.');

// ── 11 근본 원인 ──────────────────────────────────────────────────────────
const srv = (t, list, c) => `<div style="flex:1; display:flex; flex-direction:column; gap:12px; background:${SURFACE}; border:2px solid ${c}; border-radius:14px; padding:28px"><p style="font-family:${MONO}; font-size:24px; font-weight:700; color:${c}">${t}</p>${list.map((x) => `<p style="font-size:28px; color:${INK}">· ${x}</p>`).join('')}</div>`;
section('root-cause', { notes: "D26 배경. 서버 한 대를 아무리 키워도 언젠가 한계다. 여러 대로 늘리면(수평 확장) 되는데, 지금 데이터가 서버 메모리 안에만 있어서(MockDataService) 여러 대를 띄우면 각자 다른 데이터를 들고 있게 된다 — 이걸 그림으로 보여준다(서버 2대가 같은 회원 목록을 다르게 보여줌). 결론: 진짜 해결은 rate limit이 아니라 데이터를 서버 밖(DB)으로 꺼내는 것." },
  head('D26 · 배경', '진짜 원인은 서버 안에 있었습니다') +
  fill(`<div style="display:flex; flex-direction:column; gap:28px">` +
    `<p style="font-size:32px; font-weight:600; color:${INK}">서버를 여러 대로 늘리면(수평 확장) 트래픽을 나눌 수 있는데 — 지금은 안 됩니다</p>` +
    `<div style="display:flex; gap:24px">${srv('서버 인스턴스 A', ['방금 등록한 회원 O', '메모리에만 존재'], AMBER)}${srv('서버 인스턴스 B', ['방금 등록한 회원 X', '서로 다른 메모리'], RED)}</div>` +
    `</div>`) +
  foot('MockDataService = 인스턴스별 인메모리 상태 · 데이터가 서버 밖(DB)에 있어야 여러 대를 띄울 수 있다'));

// ── 12 결정 3 — D26 → Lambda 계획 ─────────────────────────────────────────
decisionSlide('migration', 'D26 → 계획 · 결정 3', '무상태화 먼저, 인프라 이전은 그다음',
  'Lambda의 다중 인스턴스 모델이 지금의 인메모리 mock과 근본적으로 안 맞는다 — 무상태화가 전제조건',
  [
    ['지금 바로 전체를 Lambda로', 'mock인 15개 도메인의 동시성 정합성 버그가 데모 중 재현될 위험', false],
    ['Oracle Cloud 무료 VM으로 전환', '스로틀링은 없어지지만 수평 확장 서사 자체는 안 생김', false],
    ['Render 유료 업그레이드', '무료 유지 원칙(D23)을 깨는 비용 발생, 확장성도 그대로', false],
    ['Prisma 전체 이관 후 Lambda', '안전하지만 느림 — 이번 주 인증 모듈부터 실제 Postgres로 착수', true],
  ],
  '전 도메인 Prisma 이관을 완료한 뒤 API를 Lambda 호출 구조로 이전한다. DB(Supabase)는 그대로 유지 — 안 풀리면 DB 인프라도 재검토한다',
  '2026-09-28 · docs/2.decisions/50_결정및이슈기록/2-1_기술결정사항.md D26 — 인증 모듈부터 실제 Postgres 위에서 검증 완료',
  '결정 3(D26 + 이후 계획, 2026-09-28). 왜 인증 모듈부터인가 — 모든 요청이 거쳐가는 가장 위험한 경로. 처음엔 순수 Prisma로 바꿨다가 116개 테스트가 깨져서 "Prisma 우선, 없으면 mock 폴백" 이중 경로로 재설계했다(시간 되면 언급). 실제 Postgres 위에서 로그인·토큰갱신·비밀번호변경을 수동 curl로 확인했다는 걸 강조 — "될 것 같다"가 아니라 "실행해서 확인했다". Lambda를 지금(도메인 이관 전) 먼저 올리는 안, Oracle VM으로 스로틀링만 먼저 없애는 안도 검토했지만, mock 도메인의 동시성 리스크와 확장성 서사 상실을 이유로 기각했다는 것도 질문 나오면 설명.');

// ── 13 로드맵 ─────────────────────────────────────────────────────────────
section('roadmap', { notes: '3단계 로드맵, 이번 주 재확정(2026-09-28). 지금까지 본 결정 1~3을 한 장으로 정리하는 슬라이드. 1단계(엣지 rate limit)는 완료했지만 근본 해결이 아니라는 걸 앞서 밝혔다. 2단계(전 도메인 Prisma 이관)는 진행 중 — 인증만 끝남. 3단계는 DB는 기존 결정(Supabase)을 유지하고 API를 Lambda 호출 구조로 옮기는 구체적 계획을 세워뒀다고 말한다. 다만 아직 계획 단계이지 착수는 아니다 — "결정했다"와 "다 했다"를 구분. 안전장치: 이 계획대로 안 풀리면 DB 인프라 자체도 재검토 대상이라는 걸 숨기지 않는다 — 무료 킵얼라이브(Cloudflare Cron)도 같은 맥락의 보조 수단으로 질문 나오면 언급.' },
  head('지금까지의 결정, 한눈에', '이렇게 진행하기로 했습니다') +
  `<div style="display:flex; flex-direction:column; gap:36px; flex:1; justify-content:center">` +
  `<div style="display:flex; gap:12px; height:230px">${ph('1단계', '엣지 rate limit', 1, '완료 · 근본 해결 아님', 'done')}${ph('2단계', '전 도메인 Prisma 이관\n(무상태화)', 1.3, '진행 중 · 인증만 완료', 'part')}${ph('3단계', 'Lambda로 API 이전\n(DB는 Supabase 유지)', 1.3, '구현 계획 수립', 'plan')}</div>` +
  card(`<p style="font-family:${MONO}; font-size:24px; font-weight:600; letter-spacing:2px; color:${NAVY}">이 계획대로 안 풀리면</p><p style="font-size:30px; font-weight:600; line-height:1.4; color:${INK}">Lambda + Supabase 조합을 진행해보고 기대만큼 안 되면, <b style="color:${AMBER}">DB 인프라도 함께 재검토</b>합니다.</p>`) +
  `</div>` +
  foot('D24의 단계적 로드맵 + 2026-09-28 방향 재확정 — DB(Supabase)는 그대로, API 호스팅만 단계적으로 이전'));

// ── 15 라이브 데모 ────────────────────────────────────────────────────────
section('demo', { pad: '128px 176px', gap: 24, notes: '오늘 라이브로 보여드리는 건 로그인 하나입니다. 실제 배포 주소에서 데모 계정 카드를 직접 클릭해 로그인이 실제로 동작한다는 걸 보여준다. 계정: 김민수(서초점 지점 관리자). 기대치 관리 — 나머지는 이미 슬라이드로 다뤘다.' },
  `<div style="flex:1"></div>` +
  head('라이브 데모', '지금 실제로 로그인해 보겠습니다') +
  fill(card(`<p style="font-size:34px; font-weight:600; line-height:1.5; color:${INK}">오늘 보여드릴 라이브는 <b style="color:${NAVY}">이것 하나</b>입니다.</p><p style="font-size:28px; line-height:1.5; color:${SOFT}">실제 배포 주소(Cloudflare Worker)에서 지점 관리자 계정으로 로그인해, 이번 주에 실측·수정한 배포 경로가 실제로 동작하는 걸 확인합니다.</p>`)) +
  `<div style="flex:1"></div>`);

// ── 16 마무리 ─────────────────────────────────────────────────────────────
section('closing', { pad: '128px 176px', gap: 24, notes: '질문과 토론. Q&A 대비는 구성안 §5 참고: B/C 진행 상태 과장 금지, 이중 경로 설계, skip 테스트 이유, k6 재현 불가, 성장 시나리오 관점, Lambda 미착수, CI Postgres 추가 이유.' },
  dots(400, 780, 700, 460) + `<div style="flex:1"></div><h1 style="font-family:${DISPLAY}; font-size:176px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:${INK}">감사합니다</h1><p style="font-size:44px; color:${SOFT}">질문 환영합니다.</p><div style="flex:1"></div>`);

// ── 린트 ──────────────────────────────────────────────────────────────────
const problems = [];
for (const s of slides) {
  const noSvg = s.html.replace(/<svg[\s\S]*?<\/svg>/g, '');
  if (/<style|class=|z-index|margin\s*:|var\(|\d\s*em[;"' ]/.test(noSvg)) problems.push(`${s.id}: 허용되지 않은 CSS/속성 의심`);
  if (/<text[\s>]/.test(s.html)) problems.push(`${s.id}: svg 안에 <text>`);
  (noSvg.match(/font-size:(\d+(?:\.\d+)?)px/g) || []).forEach((m) => { if (parseFloat(m.split(':')[1]) < 24) problems.push(`${s.id}: 24px 미만 ${m}`); });
  if ((noSvg.match(/<[a-z-]+/g) || []).length > 200) problems.push(`${s.id}: 요소 200개 초과`);
  (s.html.match(/<svg[\s\S]*?<\/svg>/g) || []).forEach((v) => { if (Buffer.byteLength(v) > 52 * 1024) problems.push(`${s.id}: svg 52KB 초과`); });
  s.kb = (Buffer.byteLength(s.html) / 1024).toFixed(1);
}

fs.mkdirSync(path.join(OUT, 'project', 'slides'), { recursive: true });
for (const s of slides) fs.writeFileSync(path.join(OUT, 'project', 'slides', s.id + '.html'), s.html, 'utf8');
const deck = {
  v: 4,
  createdOnFiles: { v: 1, at: '2026-09-28T00:00:00Z' },
  title: '4주차 진행상황 발표',
  order,
  sections: {
    intro: { description: '이번 주 한 줄 요약', start: 'cover' },
    cycle: { description: 'Part A — 도메인 사이클이 실제로 작동했다', start: 'cycle-method' },
    deploy: { description: 'Part B — 배포하자마자 진짜 병목을 만났다', start: 'deploy' },
    fix: { description: 'Part C — 근본 원인을 없애는 방향', start: 'root-cause' },
    wrap: { description: '라이브 데모와 마무리', start: 'demo' },
  },
  faces: {
    'gothic-a1': { family: 'Gothic A1', href: 'https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;500;700;900&display=swap' },
    'noto-sans-kr': { family: 'Noto Sans KR', href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap' },
    'jetbrains-mono': { family: 'JetBrains Mono', href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap' },
  },
  designSystems: [],
};
fs.writeFileSync(path.join(OUT, 'project', 'deck.json'), JSON.stringify(deck, null, 2), 'utf8');
console.log('슬라이드', slides.length + '장:', order.join(' '));
console.log(slides.map((s) => `${s.id}(${s.kb}KB)`).join(' '));
console.log(problems.length ? '린트 ' + problems.length + '건\n' + problems.join('\n') : '린트 문제 없음');
console.log('도식 경고:', lib.WARN.length ? lib.WARN.join(' | ') : '없음');
