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

const ph = (id, name, w, status, kind) => {
  const bg = kind === 'done' ? GREEN_SOFT : kind === 'part' ? AMBER_SOFT : GRAY_SOFT;
  const c = kind === 'done' ? GREEN : kind === 'part' ? AMBER : GRAY;
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

// ── 6 실제 배포 (Part B) ─────────────────────────────────────────────────
const flowBox = (t, d, k) => {
  const bg = k === 'navy' ? NAVY_SOFT : k === 'green' ? GREEN_SOFT : SURFACE;
  const c = k === 'navy' ? NAVY : k === 'green' ? GREEN : LINE_STRONG;
  return `<div style="flex:1; display:flex; flex-direction:column; gap:10px; background:${bg}; border:1px solid ${c}; border-radius:14px; padding:32px; box-shadow:${SHADOW}"><h3 style="font-family:${DISPLAY}; font-size:36px; font-weight:700; color:${INK}">${t}</h3><p style="font-size:26px; line-height:1.4; color:${SOFT}">${d}</p></div>`;
};
const bigArrow = `<div style="display:flex; align-items:center"><p style="font-size:56px; font-weight:700; color:${NAVY}">→</p></div>`;
section('deploy', { notes: 'Part B 시작(6분, 이번 발표의 핵심). 지금까지는 로컬에서만 동작을 확인했는데, 처음으로 인터넷에 띄웠다(D23). admin-web+api 게이트웨이는 Cloudflare Worker 하나에, api 서버는 Render, DB는 Supabase — 전부 무료 티어. 이 배포가 있었기 때문에 다음 슬라이드의 부하테스트가 가능했다. 질문 대비 — Worker와 Pages는 다른 제품이다. 원래 admin-web은 Pages에 올릴 계획이었는데(D23 원안), 이 세션이 쓰는 Cloudflare MCP 커넥터에 Pages를 만드는 툴이 아예 없다는 걸 배포 단계에서 발견했고, D24에서 rate limit용 Worker를 따로 세웠다가 admin-web(Render)과 오리진이 갈라지는 문제가 생겨(D25) 아예 admin-web을 이 Worker의 정적 자산(Static Assets 기능)으로 흡수했다 — 그래서 지금은 Pages를 한 번도 쓴 적이 없다.' },
  head('Part B · 배포와 병목', '처음으로 인터넷에 띄웠습니다') +
  fill(`<div style="display:flex; align-items:stretch; gap:20px">` +
    flowBox('admin-web + api 게이트웨이', 'Cloudflare Worker\n(정적 자산 + 엣지 rate limit)', 'navy') + bigArrow +
    flowBox('api 서버', 'Render\n(NestJS, 무료 웹 서비스)', 'plain') + bigArrow +
    flowBox('DB', 'Supabase\n(PostgreSQL, 스키마 배포 완료)', 'green') +
    `</div>`) +
  foot('D23 · 세 서비스 모두 GitHub 연동, push마다 자동 재배포 · 전부 무료 티어<br>Cloudflare Worker ≠ Pages — Static Assets 기능으로 Worker 하나가 정적 파일 서빙과 API 게이트웨이를 겸합니다'));

// ── 7 왜 부하테스트를 했나 ────────────────────────────────────────────────
section('loadtest-setup', { notes: '"느릴 것 같다"는 추측 대신 k6로 실측했다. 시나리오는 두 가지 — 로그인 0~40명 램핑(bcrypt가 CPU 바운드라 먼저 무너질 지점), 조회 0~100명 램핑(인메모리라 원래 빠름). 위탁계약이 이미 98개라는 사실을 근거로 "몇 명 안 되는데 문제 생기겠어?"라는 반박을 미리 막는다.' },
  head('Part B · 배포와 병목', '왜 부하테스트를 했나') +
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
  head('Part B · 배포와 병목', '동시 로그인 40명에 15초가 걸렸습니다') +
  fill(`<div style="display:flex; gap:20px">${bignum('65ms', '정상 처리\n(로컬)', 'green')}${bignum('15.16초', 'Render 무료 티어\n로그인 p95', 'amber')}</div>`) +
  card(`<p style="font-family:${MONO}; font-size:24px; font-weight:600; letter-spacing:2px; color:${NAVY}">40명 램핑 중 무너진 패턴</p><div style="display:flex; align-items:center; gap:20px">${chip('7.4초', 'gray')}<p style="font-size:32px; color:${SOFT}">→</p>${chip('15.16초', 'amber')}<p style="font-size:32px; color:${SOFT}">→</p>${chip('17.11초', 'red')}<p style="font-size:28px; color:${SOFT}; margin-left:12px">완만히 늘지 않고 급격히 무너졌다</p></div>`) +
  foot('2026-09-27 k6 실측 · 코드 문제가 아니라 Render 무료 티어 공유 CPU 스로틀링'));

// ── 9 왜 이렇게 되는가 ────────────────────────────────────────────────────
section('bottleneck', { notes: "Little's Law로 설명되는 자기강화 루프. 지연이 발생하면 동시 진행 건수(L=λW)가 늘고, 늘어난 요청이 CPU 경합을 심화시키고, 그게 다시 처리시간을 늘려 루프가 증폭된다. 정상 처리(65ms) 시 동시 진행 로그인은 0.12건이라 평소엔 전혀 문제가 안 되지만, 15.16초로 늘어나는 순간 같은 공식이 28.5건으로 밀어올린다. 3년 후(98→130개 지점) 추정으로는 장애 상황 동시 진행이 38.4건까지 간다." },
  head('Part B · 배포와 병목', '왜 이렇게 되는가 — 자기강화 루프') +
  diagramCard(F.bottleneckLoop) +
  foot("design-constants.md ⑦~⑨ · Little's Law 역산 — 3년 후 추정 시 장애 상황 동시 진행 로그인 ≈38.4건"));

// ── 10 즉시 대응 ─────────────────────────────────────────────────────────
section('edge-fix', { notes: '1단계 즉시 대응(D24 1단계, 완료). Rate limit을 앱 코드 안이 아니라 Cloudflare Worker(엣지)에 세워서, Render 컨테이너 CPU에 닿기도 전에 과도한 요청을 걸러낸다. 보안 대책(rate limit)과 용량 대책(수평 확장)을 뒤섞지 않고 분리한 게 핵심 — rate limit은 악의적 요청은 막지만 "퇴근 후 동시 정상 로그인"은 못 막는다는 것도 노트로 남긴다.' },
  head('Part B · 배포와 병목', '1단계 즉시 대응 — 엣지에서 막는다') +
  fill(`<div style="display:flex; align-items:stretch; gap:20px">` +
    flowBox('브라우저', '로그인 요청', 'plain') + bigArrow +
    flowBox('Cloudflare Worker', '엣지에서 과도한 요청을 먼저 차단', 'navy') + bigArrow +
    flowBox('Render api', 'CPU에 닿기도 전에 걸러진 뒤라 안전', 'green') +
    `</div>`) +
  `<div style="display:flex">${pill('완료 — D24 1단계', GREEN_SOFT, GREEN)}</div>` +
  foot('앱 레벨 rate limit보다 나은 이유 — 요청이 Render CPU를 조금이라도 쓰기 전에 걸러진다'));

// ── 11 오리진 통합 ────────────────────────────────────────────────────────
section('origin-fix', { notes: 'D24 배포 직후 로그인 실패·새로고침 404가 났다. 원인은 admin-web(Render)과 api 게이트웨이(Cloudflare Worker)가 서로 다른 주소(오리진)가 된 것. 각 버그를 따로 땜질하는 대신, admin-web을 아예 같은 Worker의 정적 자산으로 통합해 오리진 분리 자체를 없앴다(D25). 이 과정에서 실제로 겪은 두 개별 버그(_redirects 무한루프, .env 프로덕션 오염)는 Q&A로만 다룬다.' },
  head('Part B · 배포와 병목', '버그를 고치지 않고, 버그가 날 구조를 없앴습니다') +
  fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
    `<div style="flex:1; display:flex; flex-direction:column; gap:16px; background:${RED_SOFT}; border:1px solid ${RED}; border-radius:14px; padding:32px"><p style="font-family:${MONO}; font-size:24px; font-weight:700; color:${RED}">이전 — 오리진이 갈라짐</p><p style="font-size:28px; line-height:1.5; color:${INK}">admin-web(Render)과 api 게이트웨이(Worker)가 서로 다른 주소가 되며 로그인 실패·새로고침 404 발생</p></div>` +
    bigArrow +
    `<div style="flex:1; display:flex; flex-direction:column; gap:16px; background:${GREEN_SOFT}; border:1px solid ${GREEN}; border-radius:14px; padding:32px"><p style="font-family:${MONO}; font-size:24px; font-weight:700; color:${GREEN}">이후 — 오리진을 통합</p><p style="font-size:28px; line-height:1.5; color:${INK}">admin-web을 같은 Worker의 정적 자산으로 흡수 — CORS라는 변수 자체가 사라짐</p></div>` +
    `</div>`) +
  foot('D25 · 2026-09-28 사용자 확인 — 로그인·새로고침 둘 다 해소'));

// ── 12 근본 원인 (Part C) ─────────────────────────────────────────────────
const srv = (t, list, c) => `<div style="flex:1; display:flex; flex-direction:column; gap:12px; background:${SURFACE}; border:2px solid ${c}; border-radius:14px; padding:28px"><p style="font-family:${MONO}; font-size:24px; font-weight:700; color:${c}">${t}</p>${list.map((x) => `<p style="font-size:28px; color:${INK}">· ${x}</p>`).join('')}</div>`;
section('root-cause', { notes: "Part C 시작(3분). 서버 한 대를 아무리 키워도 언젠가 한계다. 여러 대로 늘리면(수평 확장) 되는데, 지금 데이터가 서버 메모리 안에만 있어서(MockDataService) 여러 대를 띄우면 각자 다른 데이터를 들고 있게 된다 — 이걸 그림으로 보여준다(서버 2대가 같은 회원 목록을 다르게 보여줌). 결론: 진짜 해결은 rate limit이 아니라 데이터를 서버 밖(DB)으로 꺼내는 것." },
  head('Part C · 근본 해결 방향', '진짜 원인은 서버 안에 있었습니다') +
  fill(`<div style="display:flex; flex-direction:column; gap:28px">` +
    `<p style="font-size:32px; font-weight:600; color:${INK}">서버를 여러 대로 늘리면(수평 확장) 트래픽을 나눌 수 있는데 — 지금은 안 됩니다</p>` +
    `<div style="display:flex; gap:24px">${srv('서버 인스턴스 A', ['방금 등록한 회원 O', '메모리에만 존재'], AMBER)}${srv('서버 인스턴스 B', ['방금 등록한 회원 X', '서로 다른 메모리'], RED)}</div>` +
    `</div>`) +
  foot('MockDataService = 인스턴스별 인메모리 상태 · 데이터가 서버 밖(DB)에 있어야 여러 대를 띄울 수 있다'));

// ── 13 착수 ───────────────────────────────────────────────────────────────
section('migration', { notes: 'D26. 왜 인증 모듈부터인가 — 모든 요청이 거쳐가는 가장 위험한 경로. 처음엔 순수 Prisma로 바꿨다가 116개 테스트가 깨져서, "Prisma에서 먼저 찾고 없으면 mock으로 폴백"하는 이중 경로로 설계를 바꿨다는 것도 짧게 언급 가능(시간 되면). 실제 Postgres 위에서 로그인·토큰갱신·비밀번호변경을 수동 curl로 확인했다는 걸 강조 — "될 것 같다"가 아니라 "실행해서 확인했다".' },
  head('Part C · 근본 해결 방향', '가장 위험한 경로부터 옮기기 시작했습니다') +
  fill(card(`<p style="font-family:${MONO}; font-size:24px; font-weight:600; letter-spacing:2px; color:${NAVY}">D26 · MockDataService → PostgreSQL(Prisma) 전환 1단계</p><p style="font-size:32px; font-weight:600; line-height:1.5; color:${INK}">인증 모듈(로그인·토큰갱신·비밀번호변경)부터 실제 Postgres 위에서 검증했습니다 — 모든 요청이 거쳐가는 가장 위험한 경로이기 때문입니다.</p>`) +
    `<div style="height:20px"></div>` +
    sbullets(['실제 Postgres 위에서 로그인·토큰갱신·비밀번호변경을 직접 확인', '아직 mock인 도메인이 깨지지 않도록 안전한 전환 경로로 설계', '남은 도메인은 16개 중 15개 — 같은 도메인 사이클 방식으로 하나씩'])) +
  foot('2026-09-28 · docs/2.decisions/50_결정및이슈기록/2-1_기술결정사항.md D26'));

// ── 14 로드맵 ─────────────────────────────────────────────────────────────
section('roadmap', { notes: '3단계 로드맵. 1단계(엣지 rate limit) 완료, 2단계(전 도메인 무상태화) 진행 중 — 인증만 끝남, 3단계(수평 확장/유료 플랜)는 성장 시점. 무료 킵얼라이브(Cloudflare Cron)는 합의는 됐지만 아직 착수 전이라고 분명히 말한다 — "결정했다"와 "다 했다"를 구분.' },
  head('Part C · 근본 해결 방향', '앞으로 3단계로 쌓습니다') +
  `<div style="display:flex; flex-direction:column; gap:36px; flex:1; justify-content:center">` +
  `<div style="display:flex; gap:12px; height:230px">${ph('1단계', '엣지 rate limit', 1, '완료', 'done')}${ph('2단계', '전 도메인 무상태화\n(Prisma 전환)', 1.6, '진행 중 · 인증만 완료', 'part')}${ph('3단계', '수평 확장 · 유료 플랜', 1, '성장 시점', 'gray')}</div>` +
  card(`<p style="font-family:${MONO}; font-size:24px; font-weight:600; letter-spacing:2px; color:${NAVY}">곁가지 — 당장의 체감 개선</p><p style="font-size:30px; font-weight:600; line-height:1.4; color:${INK}">무료 킵얼라이브(Cloudflare Cron으로 Render·Supabase 깨워두기)를 방향으로 합의했지만, <b style="color:${AMBER}">아직 착수 전</b>입니다.</p>`) +
  `</div>` +
  foot('D24의 단계적 로드맵 + 2026-09-28 방향 합의'));

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
