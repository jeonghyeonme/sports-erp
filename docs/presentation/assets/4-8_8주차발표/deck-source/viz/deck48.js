// 8주차 진행 발표 덱 — 2026-10-26 ~ 11-02. 구성안: docs/presentation/4-8_8주차발표_슬라이드구성.md
// 원칙(사용자): 택한 방식과 이유만, 이전 설계·대안·테스트 수치는 넣지 않는다, 포장하지 않는다. 디자인·린트는 6주차 deck46.js와 같다.
// 실행: node viz/deck48.js deck-out   → deck-out/project/{deck.json, slides/*.html}
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2];
const BODY = "'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";
const DISPLAY = "'Gothic A1', 'Noto Sans KR', 'Malgun Gothic', sans-serif";
const MONO = "'JetBrains Mono', 'Noto Sans KR', Consolas, monospace";
const BG = '#F4F5F3', SURFACE = '#FFFFFF', SURFACE2 = '#EBEEEC', INK = '#14191C', SOFT = '#4B5563';
const LINE = '#E1E4E1', LINE_STRONG = '#CBD0CD';
const NAVY = '#1E3A5F', NAVY_SOFT = '#E7ECF1', AMBER = '#9A5A0C', AMBER_SOFT = '#FBEEDD';
const GREEN = '#187650', GREEN_SOFT = '#E3F3EB', GRAY = '#5B6470', GRAY_SOFT = '#EDEFEE';
const RED = '#B3261E';
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
// 덩어리 사이 간격은 빈 div가 아니라 gap으로 준다(Slides 렌더러는 높이만 준 빈 div를 버린다).
const fill = (inner, extra = '') => `<div style="flex:1; display:flex; flex-direction:column; justify-content:center; gap:32px; ${extra}">${inner}</div>`;
const card = (inner, extra = '') => `<div style="display:flex; flex-direction:column; gap:14px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; padding:36px; box-shadow:${SHADOW}; ${extra}">${inner}</div>`;
const pill = (t, bg, color, extra = '') => `<p style="font-family:${MONO}; font-size:24px; font-weight:600; color:${color}; background:${bg}; border-radius:999px; padding:4px 18px; white-space:nowrap; ${extra}">${t}</p>`;
const label = (t, c = NAVY) => `<p style="font-family:${MONO}; font-size:24px; font-weight:600; letter-spacing:2px; color:${c}">${t}</p>`;
const h3 = (t, size = 40, c = INK) => `<h3 style="font-family:${DISPLAY}; font-size:${size}px; font-weight:700; line-height:1.25; color:${c}">${t}</h3>`;
const ptxt = (t, size = 28, c = SOFT, w = 400) => `<p style="font-size:${size}px; font-weight:${w}; line-height:1.45; color:${c}">${t}</p>`;
const icon = (n, c, s = 30) => `<x-icon name="${n}" style="color:${c}; width:${s}px; height:${s}px"></x-icon>`;
const bullets = (arr, size = 28, ic = 'Check', c = GREEN) => `<div style="display:flex; flex-direction:column; gap:14px">${arr.map((t) => `<div style="display:flex; align-items:flex-start; gap:14px">${icon(ic, c)}<p style="font-size:${size}px; line-height:1.4; color:${INK}">${t}</p></div>`).join('')}</div>`;
const statePill = (k, t) => {
  const m = { done: [GREEN_SOFT, GREEN], plan: [NAVY_SOFT, NAVY], part: [AMBER_SOFT, AMBER], out: [GRAY_SOFT, GRAY], navy: [NAVY, '#F4F5F3'] }[k];
  return pill(t, m[0], m[1]);
};
const pillRow = (...p) => `<div style="display:flex; gap:12px">${p.join('')}</div>`;
const arrowR = (c = LINE_STRONG) => `<div style="display:flex; align-items:center; justify-content:center"><x-shape kind="arrow-right" style="background:${c}; width:44px; height:26px"></x-shape></div>`;
const arrowD = (c = LINE_STRONG) => `<div style="display:flex; justify-content:center"><x-shape kind="arrow-down" style="background:${c}; width:26px; height:40px"></x-shape></div>`;
const bridge = (t, c = NAVY, soft = NAVY_SOFT, ic = 'Lightbulb') => `<div style="display:flex; align-items:center; gap:18px; padding:22px 30px; background:${soft}; border-left:6px solid ${c}; border-radius:10px">${icon(ic, c)}<p style="font-size:30px; font-weight:600; line-height:1.4; color:${c}">${t}</p></div>`;
const tableCard = (inner) => `<div style="background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; padding:20px 32px; box-shadow:${SHADOW}">${inner}</div>`;
const table = (size, colsPct, headers, rows) =>
  `<table style="font-size:${size}px; color:${INK}; font-family:${BODY}"><tr>${headers.map((h, i) => `<th style="width:${colsPct[i]}%; text-align:left; color:${SOFT}">${h}</th>`).join('')}</tr>${rows.map((r) => `<tr style="background:${SURFACE}">${r.map((c) => `<td style="text-align:left">${c}</td>`).join('')}</tr>`).join('')}</table>`;

function dots(cx, cy, rx, ry, gap = 40) {
  const g = { a: [], b: [], c: [] };
  for (let x = gap / 2; x < 1920; x += gap) for (let y = gap / 2; y < 1080; y += gap) {
    const t = Math.hypot((x - cx) / rx, (y - cy) / ry);
    if (t < 1) g[t < 0.4 ? 'a' : t < 0.7 ? 'b' : 'c'].push(`<circle cx="${x}" cy="${y}" r="2.4"/>`);
  }
  const grp = (k, o) => `<g fill="${LINE_STRONG}" fill-opacity="${o}">${g[k].join('')}</g>`;
  return `<svg aria-label="장식용 점 격자" viewBox="0 0 1920 1080" width="1920" height="1080" style="position:absolute; left:0px; top:0px; width:1920px; height:1080px">${grp('c', 0.22)}${grp('b', 0.4)}${grp('a', 0.62)}</svg>`;
}

// 캡처(아티팩트 자산 — 원본은 ../screenshots/). 비어 있으면 빈 프레임으로 그린다.
const IMG = { rounds: '/_blob/a9a8382e4385ac0f2c1933c1b249c6a1' }; // c-rounds.png 2318×1110, 마포점 1회차 계약서 → 2회차 갱신 후
const browser = (src, url, w, h, alt) =>
  `<div style="display:flex; flex-direction:column; width:${w}px; background:${SURFACE}; border:1px solid ${LINE_STRONG}; border-radius:14px; box-shadow:${SHADOW}; overflow:hidden">` +
  `<div style="display:flex; align-items:center; gap:10px; padding:12px 20px; background:${SURFACE2}; border-bottom:1px solid ${LINE}">` +
  `<div style="width:14px; height:14px; border-radius:50%; background:#D9534F"></div><div style="width:14px; height:14px; border-radius:50%; background:#E0A43A"></div><div style="width:14px; height:14px; border-radius:50%; background:#4CAF6A"></div>` +
  `<p style="font-family:${MONO}; font-size:24px; color:${SOFT}; padding:0px 0px 0px 16px; white-space:nowrap">${url}</p></div>` +
  `<img src="${src}" alt="${alt}" style="width:${w}px; height:${h}px; object-fit:contain; background:${SURFACE}"></div>`;
const browserPH = (url, w, h, what) =>
  `<div style="display:flex; flex-direction:column; width:${w}px; background:${SURFACE}; border:1px solid ${LINE_STRONG}; border-radius:14px; box-shadow:${SHADOW}; overflow:hidden">` +
  `<div style="display:flex; align-items:center; gap:10px; padding:12px 20px; background:${SURFACE2}; border-bottom:1px solid ${LINE}">` +
  `<div style="width:14px; height:14px; border-radius:50%; background:#D9534F"></div><div style="width:14px; height:14px; border-radius:50%; background:#E0A43A"></div><div style="width:14px; height:14px; border-radius:50%; background:#4CAF6A"></div>` +
  `<p style="font-family:${MONO}; font-size:24px; color:${SOFT}; padding:0px 0px 0px 16px; white-space:nowrap">${url}</p></div>` +
  `<div style="height:${h}px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; background:${GRAY_SOFT}">${icon('Search', GRAY, 48)}<p style="font-size:30px; font-weight:600; color:${INK}">${what}</p><p style="font-family:${MONO}; font-size:24px; color:${GRAY}">캡처 자리</p></div></div>`;
// 파트 구분 슬라이드 — 청중의 질문을 크게
function partSlide(id, no, name, question, notes) {
  section(id, { bg: NAVY, ink: '#F4F5F3', pad: '128px 176px', gap: 24, notes },
    `<div style="flex:1"></div>` +
    `<p style="font-family:${MONO}; font-size:28px; font-weight:600; letter-spacing:4px; color:#B9C7D8">PART ${no}</p>` +
    `<h1 style="font-family:${DISPLAY}; font-size:120px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:#F4F5F3">${name}</h1>` +
    `<p style="font-size:44px; font-weight:500; color:#D7E0EA">${question}</p>` +
    `<div style="flex:1"></div>`);
}

// ════════════════════════════════════════════════════════════════════════
// 도입
// ════════════════════════════════════════════════════════════════════════
section('cover', { pad: '128px 176px', gap: 20, notes: '8주차 진행 발표. 범위는 10/26(월)부터 11/2(월)까지. 라이브 데모 없이 캡처로 보인다. 순서: 계약서 OCR·AI를 넣지 않은 이유 → 계약 관리(회차·계약서 종류별 처리·종료 확정·입력 오류 방지·한계·보존) → 동시성 점검 → 정리.' },
  dots(1500, 430, 780, 520) +
  `<div style="flex:1"></div>` +
  `<div style="display:flex"><p style="font-family:${MONO}; font-size:24px; letter-spacing:2px; color:${NAVY}; background:${NAVY_SOFT}; border:1px solid ${LINE}; border-radius:999px; padding:8px 24px">SPOISM ERP · WEEK 8</p></div>` +
  `<h1 style="font-family:${DISPLAY}; font-size:176px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:${INK}">스포이즘 ERP</h1>` +
  `<p style="font-size:52px; font-weight:500; color:${SOFT}">8주차 진행 발표</p>` +
  `<div style="height:36px"></div>` +
  `<p style="font-family:${MONO}; font-size:28px; color:${SOFT}"><b>발표자</b>&nbsp; 박정현 &nbsp;&nbsp;·&nbsp;&nbsp; <b>범위</b>&nbsp; 2026-10-26 ~ 11-02</p>` +
  `<div style="flex:1"></div>`);

const agendaRow = (no, name, q) => `<div style="display:flex; align-items:center; gap:28px; padding:24px 28px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:12px"><p style="font-family:${MONO}; font-size:28px; font-weight:700; color:${NAVY}; width:60px">${no}</p><p style="font-family:${DISPLAY}; font-size:36px; font-weight:700; color:${INK}; width:420px">${name}</p><p style="font-size:30px; color:${SOFT}">${q}</p></div>`;
section('agenda', { notes: '중간보고(10/23) 이후 일주일. 중간보고의 다음 계획 중 하나가 "계약서 OCR·AI 검토"였고, 그 검토에서 출발했다. 01에서 넣지 않기로 한 이유, 02에서 그 대신 만든 계약 관리, 03에서 계약 기능을 만든 뒤 전체 쓰기 기능을 대상으로 한 동시성 점검을 다룬다.' },
  head('오늘 순서', '세 가지를 다룹니다') +
  fill(`<div style="display:flex; flex-direction:column; gap:16px">` +
    agendaRow('01', '계약서 OCR·AI', '넣지 않은 이유') +
    agendaRow('02', '계약 관리', '계약 회차 · 계약서 · 종료 확정 · 보존') +
    agendaRow('03', '동시성 점검', '겹치는 요청을 어떻게 처리했나') +
    `</div>`) +
  foot('중간보고(10/23) 이후 작업'));

// ════════════════════════════════════════════════════════════════════════
// ① 계약서 OCR·AI
// ════════════════════════════════════════════════════════════════════════
partSlide('p1', '01', '계약서 OCR·AI', '계약서를 자동으로 읽어 입력할지 검토했습니다',
  '중간보고 때 다음 계획으로 "계약서 OCR·AI 분석 적용 검토"를 적었다. 검토 결과 넣지 않기로 했다.');

const reason = (no, t, d) => card(`<p style="font-family:${MONO}; font-size:28px; font-weight:700; color:${NAVY}">${no}</p>` + h3(t, 38) + ptxt(d, 28, INK), 'flex:1');
section('ai-why', { notes: '결정 기록 D69(사용자, 10/31). 이유 세 가지. ① 입력량: 계약서는 지점당 한 장이고 몇 년에 한 번 갱신된다. 입력 칸은 상대방·시작일·종료일 셋이다. 자동화로 줄일 입력이 거의 없다. ② 이 값은 계약 상태 판단의 근거이고, 종료 확정은 지점의 신규 활동을 막는다. 자동으로 채운 값은 확인 없이 넘기기 쉬워서, 사람이 계약서를 보며 넣는 쪽을 택했다. ③ OCR·AI 서비스를 쓰려면 계약서(계약 상대방·조건이 담긴 문서)를 외부로 보내야 한다. 원본은 회차에 남으므로 입력값과 나중에 대조할 수 있다. 다시 검토할 조건: 실제 운영으로 계약서 입력량이 크게 늘 때. 말하지 말 것: "AI를 써 봤더니 정확도가 낮았다" — 시험해 본 적 없다.' },
  head('계약서 OCR·AI', '넣지 않고, 계약서를 보며 직접 입력합니다') +
  fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
    reason('01', '입력량이 적다', '지점당 계약서 1장, 몇 년에 한 번 갱신, 입력 칸 3개(상대방 · 시작일 · 종료일)') +
    reason('02', '확인이 필요한 값이다', '계약 상태와 신규 활동 차단의 근거라, 사람이 문서를 보고 넣는다') +
    reason('03', '외부로 보내지 않는다', 'OCR · AI 서비스에 계약서를 보내는 것 자체가 보안 위험이다') +
    `</div>` +
    bridge('계약서 원본은 회차에 남아, 입력값과 언제든 대조할 수 있습니다', NAVY, NAVY_SOFT, 'Book')) +
  foot('다시 검토할 조건: 계약서 입력량이 크게 늘 때'));

// ════════════════════════════════════════════════════════════════════════
// ② 계약 관리
// ════════════════════════════════════════════════════════════════════════
partSlide('p2', '02', '계약 관리', '계약 정보와 계약서를 시스템에서 관리합니다',
  '지금까지 앱에서 바꿀 수 있는 계약 데이터는 계약 상태 하나였다. 계약 상대방·기간은 시드 값이었고, 갱신해도 새 종료일을 넣을 곳이 없었고, 새 지점을 만들 수 없었다. 이번 주에 갱신·정정·신규 지점 등록(D68), 계약 회차와 계약서 파일(D69), 계약 파일 보존(D71)을 만들었다. 모두 본사 전용이다.');

const roundBox = (no, t, d, now) => `<div style="display:flex; flex-direction:column; gap:10px; padding:26px 28px; background:${now ? NAVY_SOFT : SURFACE}; border:2px solid ${now ? NAVY : LINE_STRONG}; border-radius:14px"><div style="display:flex; align-items:center; gap:14px">${label(no, now ? NAVY : SOFT)}${now ? statePill('navy', '지점 화면에 표시') : ''}</div>${h3(t, 34)}${ptxt(d, 26)}</div>`;
section('c-round', { notes: '계약 정보(상대방·시작일·종료일)를 지점이 아니라 계약 회차에 저장한다. 회차 번호는 지점마다 1부터. 갱신(새 계약 기간)은 새 계약서를 올리면서 새 회차를 만들고 상태를 정상으로 돌린다. 오타 정정과 계약서 교체는 회차를 늘리지 않고 진행 중 회차 안에서 한다 — 회차 기준은 계약 기간이다. 지점 화면에 보이는 계약은 가장 최근 회차다. 이유: 갱신할 때마다 그때의 계약서와 기간을 함께 남겨야 지난 계약이 무엇이었는지 확인할 수 있다. 지점 행에서 계약 칸을 없앤 이유: 같은 값을 두 곳에 두면 어긋날 수 있다. 계약 파일은 계약 화면에서만 다룬다(문서 관리에서 계약서 분류를 없앴다) — 계약서에 접근하는 경로를 하나로 둔다. 질문이 나오면: 처음엔 지점 행 + 변경 이력만으로 하려 했다(D68)가 계약서를 붙이며 회차로 바꿨다(D69).' },
  head('계약 회차', '계약 정보는 회차마다 저장합니다') +
  fill(`<div style="display:flex; gap:40px; align-items:center">` +
    `<div style="width:760px; display:flex; flex-direction:column; gap:10px">` +
      roundBox('1회차', '계약서 · 기간 · 상대방', '지난 회차 — 읽기만', false) + arrowD() +
      roundBox('2회차', '새 계약서 · 새 기간', '회차는 계약 기간 단위 — 정정·계약서 교체는 같은 회차 안에서', true) +
    `</div>` +
    `<div style="flex:1; display:flex; flex-direction:column; gap:28px">` +
      `<div style="display:flex; flex-direction:column; gap:8px">${h3('갱신마다 계약서와 기간을 함께 남긴다', 34)}${ptxt('지난 계약이 무엇이었는지 확인할 수 있습니다')}</div>` +
      `<div style="display:flex; flex-direction:column; gap:8px">${h3('지점에는 계약 칸을 두지 않는다', 34)}${ptxt('같은 값을 두 곳에 두지 않습니다')}</div>` +
      `<div style="display:flex; flex-direction:column; gap:8px">${h3('계약 파일은 계약 화면에서만', 34)}${ptxt('계약서에 접근하는 경로를 하나로 둡니다')}</div>` +
    `</div></div>`));

section('c-files', { notes: '계약서 종류별 처리(D69). 회차는 계약 기간 단위다 — 새 기간이 시작되는 갱신만 새 회차를 만들고, 오타 정정(상대방·시작일·종료일)과 계약서 파일 교체는 진행 중 회차 안에서 한다(회차 수가 늘지 않는다). 계약서: 지점 등록과 갱신 때 필수이고, 갱신은 새 계약서와 함께 새 회차를 만든다. 계약 정보는 계약서를 근거로 입력하기 때문. 해지 합의서: 종료 확정 전에 있어야 한다(다음 장). 진행 중 회차의 파일: 교체만 할 수 있고, 교체된 옛 파일은 교체 시각과 함께 남는다 — 계약 원본이 지워지지 않게. 지난 회차: 읽기만 — 끝난 계약은 바뀌면 안 된다. 권한: 올리기·교체·정정·갱신·종료 확정은 본사만. 지점 관리자는 자기 지점 계약서 열람만 할 수 있다. 열 때마다 열람 기록이 남고, 내려받기 주소는 60초 동안만 유효하다. 형식·용량 한도는 게시판 첨부와 같다.' },
  head('계약서 종류별 처리', '문서마다 언제 올리고 무엇을 할 수 있는지 정했습니다') +
  fill(tableCard(table(28, [22, 42, 36], ['종류', '처리', '이유'], [
    ['<b>계약서</b>', '지점 등록 · 갱신(새 계약 기간) 때 필수 — 새 회차', '계약 정보는 계약서를 근거로 입력'],
    ['<b>해지 합의서</b>', '종료 확정 전에 필수', '종료의 근거 문서 (다음 장)'],
    ['<b>진행 중 회차 파일</b>', '교체만 가능(회차는 그대로), 옛 파일은 남김', '원본이 지워지지 않게'],
    ['<b>지난 회차</b>', '읽기만', '끝난 계약은 바뀌면 안 됨'],
  ])) +
    `<div style="display:flex; align-items:center; gap:16px; padding:20px 28px; background:${GRAY_SOFT}; border-radius:10px">${icon('Lock', GRAY, 30)}<p style="font-size:28px; color:${INK}">쓰기는 본사만 · 지점 관리자는 자기 지점 계약서 열람만 · 열 때마다 기록 · 내려받기 주소 60초</p></div>`));

const step = (t, c = NAVY) => `<div style="padding:18px 24px; background:${SURFACE}; border:2px solid ${c}; border-radius:12px"><p style="font-size:28px; font-weight:600; color:${INK}">${t}</p></div>`;
section('c-termination', { notes: 'RFP에 없는 기능이라 넣은 이유를 말한다(D69 결정 5). 종료 확정은 버튼 하나로 그 지점의 신규 회원 등록·예약·게시·채용·발령을 막고(계약 종료 차단), 같은 처리에서 진행 중 파견을 모두 끝낸다(ADR-STF-07). 상태를 되돌려도 끝난 파견은 복구하지 않는다. 영향이 큰 처리라 계약상 종료가 확정됐다는 문서가 있어야 할 수 있게 했다. 중도 해지든 기간 만료든 같다 — 기간 경과 여부는 보지 않는다. 확정 뒤에는 그 지점에 계약 파일을 올릴 수 없으므로 문서는 확정 전에 올린다. 종료일이 지나도 상태를 자동으로 바꾸지 않고 "기간 종료(N일 경과)"로 표시만 한다 — 본사가 문서를 보고 확정한다. 실무 필요성은 현업 확인 전이다. 기간 만료 때 실무에서 쓰는 문서 이름(종료 확인서 등)과 다를 수 있다.' },
  head('계약 종료 확정', '해지 합의서를 올려야 종료를 확정할 수 있습니다') +
  `<div style="position:absolute; right:96px; top:84px; display:flex">${statePill('plan', 'RFP 외 추가')}</div>` +
  fill(`<div style="display:flex; gap:24px; align-items:stretch">` +
    card(label('종료 확정이 하는 일') + `<div style="display:flex; flex-direction:column; gap:10px">${step('신규 회원 등록 · 예약 · 게시 · 채용 · 발령 차단')}${arrowD()}${step('진행 중 파견 모두 종료')}${arrowD()}${step('되돌려도 끝난 파견은 복구하지 않음', AMBER)}</div>`, 'flex:1') +
    card(label('그래서') + bullets(['해지 합의서가 있어야 확정 버튼이 켜진다', '중도 해지든 기간 만료든 같다', '종료일이 지나도 자동 종료하지 않는다 — 본사가 문서를 보고 확정'], 30), 'flex:1') +
    `</div>` +
    bridge('영향이 큰 처리라, 종료가 확정됐다는 문서 없이 할 수 없게 했습니다', NAVY, NAVY_SOFT, 'Lightbulb')));

const guard = (t, items) => card(h3(t, 36) + bullets(items, 27), 'flex:1');
section('c-guard', { notes: '입력 단계에서 막을 수 있는 것. 필수값·날짜: 종료일 필수(기간 없는 계약은 없다), 종료일은 시작일보다 같거나 뒤, 갱신 회차의 시작일은 지난 회차보다 뒤, 지점 코드는 중복 불가(회원번호·직원코드를 만들 때 쓰인다). 상태: 종료 60일 전부터 "갱신 임박", 종료일이 지나면 "기간 종료(N일 경과)"로 표시만 한다 — 상태 변경은 본사가 한다(스케줄러 없음). 변경 이력: 등록·갱신·정정·상태 변경·파일 올리기를 같은 트랜잭션에서 변경 이력에 남긴다 — 변경이 실패하면 이력도 남지 않고, 이력 없이 바뀌는 계약 데이터도 없다.' },
  head('입력 오류 방지', '검사할 수 있는 것은 입력 단계에서 막습니다') +
  fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
    guard('필수값 · 날짜', ['종료일 필수', '종료일 ≥ 시작일', '갱신 시작일은 지난 회차보다 뒤', '지점 코드 중복 불가']) +
    guard('상태는 사람이 바꾼다', ['종료 60일 전부터 "갱신 임박" 표시', '종료일이 지나면 "기간 종료" 표시', '상태 변경은 본사가 직접']) +
    guard('변경 이력은 같은 처리 안에서', ['등록 · 갱신 · 정정 · 상태 변경 · 파일', '변경이 실패하면 이력도 남지 않음']) +
    `</div>`));

const col = (pillK, pillT, items, ic, c) => card(pillRow(statePill(pillK, pillT)) + bullets(items, 28, ic, c), 'flex:1');
section('c-limit', { notes: '시스템이 확인하는 것: 파일 형식·용량, 필수값·날짜 규칙, 종료 확정 전 해지 합의서가 있는지. 확인하지 못하는 것: 올린 파일이 그 지점의 맞는 문서인지, 입력값이 문서 내용과 같은지, 진짜 문서인지. 자동 검증(OCR·AI)은 계약서를 외부 서비스로 보내야 해서 그 자체가 보안 위험이고, 사람 확인을 늘려도 실수나 의도적으로 잘못된 입력은 남는다. 그래서 막는 대신 추적할 수 있게 남긴다: 누가 언제 올리고 입력했는지(변경 이력), 누가 열어 봤는지(열람 기록), 원본 파일(회차에 보존). 질문이 나오면: 종료 확정·갱신을 다른 본사 계정이 확인하게 하는 이중 확인을 검토할 수 있다 — 아직 정하지 않았고 만들지 않았다. 위조 여부는 전자서명 연동 없이는 확인할 수 없다.' },
  head('한계', '계약서 내용은 시스템이 검증하지 않습니다') +
  fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
    col('done', '시스템이 확인하는 것', ['파일 형식 · 용량', '필수값 · 날짜 규칙', '종료 확정 전 해지 합의서가 있는지'], 'Check', GREEN) +
    col('part', '확인하지 못하는 것', ['그 지점의 맞는 문서인지', '입력값이 문서 내용과 같은지', '진짜 문서인지'], 'Warning', AMBER) +
    `</div>` +
    ptxt('자동 검증은 계약서를 외부로 보내야 하고, 사람 확인을 늘려도 실수나 의도적으로 잘못된 입력은 남습니다.', 28, INK) +
    bridge('막는 대신 추적할 수 있게 남깁니다 — 변경 이력 · 열람 기록 · 원본 파일', NAVY, NAVY_SOFT, 'Clock')));

const tick = (t, sub, c) => `<div style="flex:1; display:flex; flex-direction:column; gap:10px; border-top:6px solid ${c}; padding:20px 0px 0px 0px">${h3(t, 32)}${ptxt(sub, 26)}</div>`;
section('c-retention', { notes: '보존 기간(D69·D71, 사용자가 정한 값): 회차가 끝난 날(해지로 끝나면 해지 확정일, 아니면 종료일)부터 시스템 3년, 이후 실물 7년. 보존 끝은 저장하지 않고 회차에서 계산한다 — 종료일을 정정하면 따라간다. 실물 이관 완료는 본사가 파일마다, 언제든(보존 끝 전에도) 표시한다. 표시해도 보존 기간 동안은 시스템에서 열람된다. 시스템 파일은 "이관 완료 + 보존 기간 지남"일 때만 본사가 정리 버튼으로 지운다. 보존 끝 6개월 전부터 이관 안 한 파일을 처리 대기함에 띄운다. 이유: 보존 기간 안에는 시스템에서 열 수 있어야 하고, 지우는 일은 사람이 확인한 뒤 누가 지웠는지 남겨야 한다. 정리 중 저장소 삭제가 실패하면 기록까지 전부 되돌린다. 정리된 파일 기록(행)은 남는다. 화면은 로컬 미리보기로만 확인했다.' },
  head('계약 파일 보존', '보존 기간 동안은 열람하고, 지우는 건 본사가 확인한 뒤에') +
  fill(`<div style="display:flex; gap:16px; align-items:stretch">` +
    tick('회차 끝', '종료일 또는 해지 확정일', NAVY) +
    tick('보존 끝 6개월 전', '이관 안 한 파일을 처리 대기함에', AMBER) +
    tick('보존 끝 (+3년)', '이후 실물로 7년', GRAY) +
    `</div>` +
    `<div style="display:flex; gap:20px; align-items:stretch">` +
    card(pillRow(statePill('plan', '실물 이관 완료')) + bullets(['본사가 파일마다, 언제든 표시', '표시해도 보존 기간 동안 열람'], 28), 'flex:1') +
    card(pillRow(statePill('navy', '보존 끝난 파일 정리')) + bullets(['이관 완료 + 보존 기간 지남일 때만', '누가 지웠는지 기록, 실패하면 전부 되돌림'], 28), 'flex:1') +
    `</div>`));

const shotPoint = (no, t) => `<div style="display:flex; gap:16px; align-items:flex-start"><p style="font-family:${MONO}; font-size:28px; font-weight:700; color:${NAVY}">${no}</p><p style="font-size:28px; line-height:1.4; color:${INK}">${t}</p></div>`;
section('c-shot', { notes: '실제 관리자 웹 화면(2026-11-02 로컬 실행, 시연 데이터를 새로 얹은 DB, 정하늘 본사 계정, 마포점 지점 상세). 시연 데이터의 기존 지점은 "계약서 미등록"으로 시작해서, 캡처 전에 화면에서 1회차에 샘플 계약서를 올리고 새 계약서로 갱신해 2회차(2026-12-08 ~ 2028-12-07)를 만들었다 — 실제 API로 한 조작이다. 마포점은 갱신 임박이었는데 갱신하면서 계약 정상으로 바뀌었다. 계약 이력에 갱신과 파일 등록이 처리자와 함께 남는다. 계약서 파일은 내용 없는 샘플 PDF다. 보존 끝·실물 이관 표시는 보존 끝이 먼 파일이라 이 화면에는 나오지 않는다.' },
  head('계약 관리 · 화면', '지점 상세의 계약 회차') +
  fill(`<div style="display:flex; gap:40px; align-items:center">` +
    (IMG.rounds ? browser(IMG.rounds, 'admin · 본사 정하늘 · 마포점 상세', 1180, 565, '지점 상세 계약 회차 표') : browserPH('admin · 본사 정하늘 · 마포점 상세', 1180, 640, '지점 상세 계약 회차 표')) +
    `<div style="flex:1; display:flex; flex-direction:column; gap:28px">` +
      shotPoint('01', '회차마다 상대방 · 기간 · 계약서') +
      shotPoint('02', '새 계약서로 갱신하면 2회차, 상태는 정상으로') +
      shotPoint('03', '계약 이력에 무엇을 누가 바꿨는지') +
    `</div></div>`));

// ════════════════════════════════════════════════════════════════════════
// ③ 동시성 점검
// ════════════════════════════════════════════════════════════════════════
partSlide('p3', '03', '동시성 점검', '쓰기 기능 전부에서 겹치는 요청을 확인했습니다',
  '계약 쓰기를 만든 뒤, 쓰기 API 전부를 "읽은 뒤 쓰기 전에 다른 요청이 끼어들 수 있는가"로 따라갔다. 예약 정원·결제·취소·근태·휴가·채번·계약 쓰기는 이미 잠금이나 조건부 갱신으로 막혀 있었다. 세 곳을 고쳤다(D70).');

section('conc-lock', { notes: '두 곳은 겹칠 수 있는 요청을 잠가서 순서대로 처리한 것이다. ① 계약 종료 확정과 회원 등록·예약 등: 종료 판정을 트랜잭션 밖에서 미리 읽어, 종료 확정과 같은 순간에 들어온 등록이 종료된 지점에 저장됐다(실DB로 10개 경로 재현). 지금은 쓰기 트랜잭션 안에서 지점 행을 공유 잠금으로 읽는다 — 종료 확정이 진행 중이면 끝날 때까지 기다렸다가 거절한다. 공유 잠금으로 한 이유: 같은 지점의 평소 쓰기끼리는 서로 기다리지 않고, 종료 확정과 겹칠 때만 기다린다. ② 퇴사와 파견 발령: 퇴사와 동시에 들어온 발령이 퇴사자에게 진행 중 파견을 남겼고, 같은 직원 동시 발령은 한쪽이 서버 오류가 났다. 두 처리 모두 시작할 때 직원 행을 잠근다. 질문이 나오면: 고치기 전에 재현 테스트를 먼저 만들어 실패를 확인했다. 잠금 순서(직원 → 지점)와 종료 처리(지점 → 파견)가 엇갈리지 않아 교착이 없다.' },
  head('겹치는 요청', '겹칠 수 있는 요청은 잠가서 순서대로 처리합니다') +
  fill(tableCard(table(28, [30, 34, 36], ['겹치는 요청', '생기던 문제', '처리'], [
    ['<b>계약 종료 확정</b><br>↔ 회원 등록 · 예약 등', '종료된 지점에 새 데이터가 저장됨', '쓰기 처리 안에서 지점을 잠그고 읽음'],
    ['<b>퇴사</b><br>↔ 파견 발령', '퇴사자에게 파견이 남음', '두 처리 모두 직원을 잠금'],
  ])) +
    bridge('지점 잠금은 공유 잠금 — 종료 확정과 겹칠 때만 기다리고, 평소 쓰기끼리는 서로 기다리지 않습니다', NAVY, NAVY_SOFT, 'Lock')));

const seq = (who, t, c = LINE_STRONG) => `<div style="display:flex; align-items:center; gap:20px"><p style="font-family:${MONO}; font-size:26px; font-weight:700; color:${NAVY}; width:120px">${who}</p><div style="flex:1; padding:16px 22px; background:${SURFACE}; border:2px solid ${c}; border-radius:12px"><p style="font-size:28px; color:${INK}">${t}</p></div></div>`;
section('conc-round', { notes: '계약 정정과 계약 파일 교체는 이미 지점 행 잠금으로 순서대로 저장되고 있었다. 문제는 순서가 아니라 대상이다. 본사 A가 1회차 화면을 열어 둔 사이 본사 B가 갱신해 2회차가 생기면, A가 1회차를 고친다고 생각한 정정·교체가 2회차에 들어갔다. 지금은 화면을 연 때의 회차 번호를 요청에 함께 보내고, 지금 회차와 다르면 거절하고 화면을 다시 열라고 안내한다. 잠금이 아닌 이유: 사람이 화면을 보는 시간 동안 DB 잠금을 쥐고 있을 수 없어서, 저장할 때 확인한다. 운영 화면에서 이 거절 안내를 직접 띄워 보지는 않았다.' },
  head('잠금으로 안 되는 곳', '계약 정정은 회차 번호를 같이 보냅니다') +
  fill(`<div style="display:flex; flex-direction:column; gap:14px">` +
    seq('본사 A', '1회차 화면을 열어 둠') +
    seq('본사 B', '갱신 → 2회차가 생김') +
    seq('본사 A', '정정 저장 → 회차 번호가 달라 거절, 다시 열라고 안내', NAVY) +
    `</div>` +
    bridge('사람이 화면을 보는 동안 DB 잠금을 유지할 수 없어서, 저장할 때 확인합니다', NAVY, NAVY_SOFT, 'Lightbulb')));

// ── 정리 ───────────────────────────────────────────────────────────────
const big = (n, t, sub) => card(`<p style="font-family:${DISPLAY}; font-size:96px; font-weight:900; line-height:1; color:${NAVY}">${n}</p>` + h3(t, 32) + ptxt(sub, 26), 'flex:1');
section('wrap', { notes: 'RFP 충족률은 지난주 중간보고에서 자세히 설명했다. 72조항 중 구현·조정 58개, 81%로 지난주와 같다. 이번 주 작업은 이미 충족한 조항을 보강한 것이고, 충족이 아닌 6조항(PG 실제 호출·업무위탁 계약서·검수와 도입·유사기업 분석 둘·기대효과)과는 관계가 없다. 운영 반영: 배포 DB 마이그레이션(승인) 후 서버·웹 재배포. 실운영은 하지 않는다 — 시연용 배포 환경이다. 다음 할 일: 문서 관리(인사서류·매뉴얼·기타)의 실제 파일 업로드, 목록·검색·정렬 통일과 시각화 같은 사용감 개선, 회원 앱 형태 재검토.' },
  head('정리', '운영 반영과 다음 할 일') +
  fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
    big('81%', 'RFP 충족률', '지난주 81% · 변화 없음') +
    card(label('운영 반영') + bullets(['배포 DB 반영', '서버 · 웹 재배포'], 28), 'flex:1') +
    card(label('다음 할 일') + bullets(['문서 관리 실제 파일 업로드', '사용감 개선', '회원 앱 형태 재검토'], 28, 'Play', NAVY), 'flex:1') +
    `</div>`));

section('closing', { pad: '128px 176px', gap: 24, notes: '맺음(말로): 계약서 OCR·AI는 넣지 않고 사람이 계약서를 보며 입력하게 했고, 그 전제로 계약 회차·계약서·종료 확정·보존을 만들었습니다. 계약서 내용 검증은 시스템이 하지 못해 추적할 수 있게 남겼습니다. 동시성은 겹치는 요청을 잠가서 순서대로 처리했고, 잠금으로 안 되는 계약 정정은 회차 번호로 확인합니다.' },
  dots(400, 780, 700, 460) + `<div style="flex:1"></div>` +
  `<h1 style="font-family:${DISPLAY}; font-size:176px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:${INK}">감사합니다</h1><div style="flex:1"></div>`);

// ── 린트 ──────────────────────────────────────────────────────────────────
const problems = [];
for (const s of slides) {
  const noSvg = s.html.replace(/<svg[\s\S]*?<\/svg>/g, '');
  if (/<style|class=|z-index|margin\s*:|var\(|\d\s*em[;"' ]/.test(noSvg)) problems.push(`${s.id}: 허용되지 않은 CSS/속성 의심`);
  if (/<text[\s>]/.test(s.html)) problems.push(`${s.id}: svg 안에 <text>`);
  (noSvg.match(/font-size:(\d+(?:\.\d+)?)px/g) || []).forEach((m) => { if (parseFloat(m.split(':')[1]) < 24) problems.push(`${s.id}: 24px 미만 ${m}`); });
  const n = (noSvg.match(/<[a-z-]+/g) || []).length;
  if (n > 200) problems.push(`${s.id}: 요소 200개 초과(${n})`);
  (s.html.match(/<svg[\s\S]*?<\/svg>/g) || []).forEach((v) => { if (Buffer.byteLength(v) > 52 * 1024) problems.push(`${s.id}: svg 52KB 초과`); });
  const aside = s.html.match(/<aside>([\s\S]*)<\/aside>/);
  if (aside && aside[1].length > 4000) problems.push(`${s.id}: 노트 4000자 초과`);
  s.kb = (Buffer.byteLength(s.html) / 1024).toFixed(1);
}

fs.mkdirSync(path.join(OUT, 'project', 'slides'), { recursive: true });
for (const s of slides) fs.writeFileSync(path.join(OUT, 'project', 'slides', s.id + '.html'), s.html, 'utf8');
const deck = {
  v: 4,
  createdOnFiles: { v: 1, at: '2026-11-02T00:00:00Z' },
  lists: 'css',
  title: '스포이즘 ERP 8주차 발표',
  order,
  sections: {
    intro: { description: '표지, 오늘 순서', start: 'cover' },
    ai: { description: '01 계약서 OCR·AI — 넣지 않은 이유', start: 'p1' },
    contract: { description: '02 계약 관리 — 계약 회차, 계약서 종류별 처리, 종료 확정, 입력 오류 방지, 한계, 보존, 화면', start: 'p2' },
    conc: { description: '03 동시성 점검 — 잠금으로 순서대로, 잠금으로 안 되는 회차 번호 확인', start: 'p3' },
    wrap: { description: '정리와 마무리', start: 'wrap' },
  },
  faces: {
    'gothic-a1': { family: 'Gothic A1', href: 'https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;500;700;800;900&display=swap' },
    'noto-sans-kr': { family: 'Noto Sans KR', href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap' },
    'jetbrains-mono': { family: 'JetBrains Mono', href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap' },
  },
  designSystems: [],
};
fs.writeFileSync(path.join(OUT, 'project', 'deck.json'), JSON.stringify(deck, null, 2), 'utf8');
console.log('슬라이드', slides.length + '장:', order.join(' '));
console.log(slides.map((s) => `${s.id}(${s.kb}KB)`).join(' '));
console.log(problems.length ? '린트 ' + problems.length + '건\n' + problems.join('\n') : '린트 문제 없음');
