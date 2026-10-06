// 종합 발표 덱 — 프로젝트 proposal · 요구사항 · 데이터 · 설계 · 기술스택(AI) + 4주차 발표 이후 진행 내역.
// 구성 원칙: 청중이 차례로 품는 질문 하나에 파트 하나로 답하고, 파트 끝 문장이 다음 파트의 질문이 된다.
//   ① 이 회사는 무엇이 문제인가 → ② 그래서 무엇을 만드나 → ③ 그 규칙을 데이터로 어떻게 담나
//   → ④ 실제로 어떻게 돌아가나 → ⑤ 무엇으로, 어떻게 만들었나 → ⑥ 지난 발표 이후 무엇이 바뀌었나
// 라이브 데모 없음. 디자인은 4-0 §4(2~4주차와 같은 언어). 구성안: docs/presentation/4-5_종합발표_슬라이드구성.md
// 실행: node viz/deck45.js deck-out   → deck-out/project/{deck.json, slides/*.html}
const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const F = require('./figs-45');
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

// 업로드한 캡처(아티팩트 자산 — 원본은 ../screenshots/)
const IMG = {
  branch: '/_blob/a738e37df6f103f5c3cd11cad931cff3', // raw_branch_detail_super.png 1600×900
  reserve: '/_blob/08444eff72488bbdf936dd8e3a18c95b', // s3_reserve_paid.png 1600×530
};

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
const card = (inner, extra = '') => `<div style="display:flex; flex-direction:column; gap:14px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; padding:36px; box-shadow:${SHADOW}; ${extra}">${inner}</div>`;
const pill = (t, bg, color, extra = '') => `<p style="font-family:${MONO}; font-size:24px; font-weight:600; color:${color}; background:${bg}; border-radius:999px; padding:4px 18px; ${extra}">${t}</p>`;
const label = (t, c = NAVY) => `<p style="font-family:${MONO}; font-size:24px; font-weight:600; letter-spacing:2px; color:${c}">${t}</p>`;
const h3 = (t, size = 40) => `<h3 style="font-family:${DISPLAY}; font-size:${size}px; font-weight:700; line-height:1.25; color:${INK}">${t}</h3>`;
const ptxt = (t, size = 28, c = SOFT, w = 400) => `<p style="font-size:${size}px; font-weight:${w}; line-height:1.45; color:${c}">${t}</p>`;
const icon = (n, c) => `<x-icon name="${n}" style="color:${c}; width:30px; height:30px"></x-icon>`;
const bullets = (arr, size = 28, ic = 'Check', c = GREEN) => `<div style="display:flex; flex-direction:column; gap:14px">${arr.map((t) => `<div style="display:flex; align-items:flex-start; gap:14px">${icon(ic, c)}<p style="font-size:${size}px; line-height:1.4; color:${INK}">${t}</p></div>`).join('')}</div>`;
const statePill = (k, t) => {
  const m = { done: [GREEN_SOFT, GREEN], plan: [NAVY_SOFT, NAVY], part: [AMBER_SOFT, AMBER], out: [GRAY_SOFT, GRAY] }[k];
  return pill(t, m[0], m[1]);
};

function dots(cx, cy, rx, ry, gap = 40) {
  const g = { a: [], b: [], c: [] };
  for (let x = gap / 2; x < 1920; x += gap) for (let y = gap / 2; y < 1080; y += gap) {
    const t = Math.hypot((x - cx) / rx, (y - cy) / ry);
    if (t < 1) g[t < 0.4 ? 'a' : t < 0.7 ? 'b' : 'c'].push(`<circle cx="${x}" cy="${y}" r="2.4"/>`);
  }
  const grp = (k, o) => `<g fill="${LINE_STRONG}" fill-opacity="${o}">${g[k].join('')}</g>`;
  return `<svg aria-label="장식용 점 격자" viewBox="0 0 1920 1080" width="1920" height="1080" style="position:absolute; left:0px; top:0px; width:1920px; height:1080px">${grp('c', 0.22)}${grp('b', 0.4)}${grp('a', 0.62)}</svg>`;
}

// 도식(1000×700) 왼쪽 + 요점 패널 오른쪽 — 카드 하나 안에
function diagramSide(build, sideInner) {
  lib.setSlide({ left: 136, top: 244, scale: 1 });
  const frag = build();
  const bg = `<div style="position:absolute; left:96px; top:212px; width:1728px; height:780px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; box-shadow:${SHADOW}"></div>`;
  const side = `<div style="position:absolute; left:1186px; top:252px; width:598px; height:700px; display:flex; flex-direction:column; justify-content:center; gap:22px; background:${SURFACE2}; border-radius:12px; padding:36px">${sideInner}</div>`;
  return bg + frag + side;
}
// 브라우저 프레임 캡처
const browser = (src, url, w, h, alt) =>
  `<div style="display:flex; flex-direction:column; width:${w}px; background:${SURFACE}; border:1px solid ${LINE_STRONG}; border-radius:14px; box-shadow:${SHADOW}; overflow:hidden">` +
  `<div style="display:flex; align-items:center; gap:10px; padding:12px 20px; background:${SURFACE2}; border-bottom:1px solid ${LINE}">` +
  `<div style="width:14px; height:14px; border-radius:50%; background:#D9534F"></div><div style="width:14px; height:14px; border-radius:50%; background:#E0A43A"></div><div style="width:14px; height:14px; border-radius:50%; background:#4CAF6A"></div>` +
  `<p style="font-family:${MONO}; font-size:24px; color:${SOFT}; padding:0px 0px 0px 16px; white-space:nowrap">${url}</p></div>` +
  `<img src="${src}" alt="${alt}" style="width:${w}px; height:${h}px; object-fit:contain; background:${SURFACE}"></div>`;
const tableCard = (inner) => `<div style="background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; padding:20px 32px; box-shadow:${SHADOW}">${inner}</div>`;
const table = (size, colsPct, headers, rows) =>
  `<table style="font-size:${size}px; color:${INK}; font-family:${BODY}"><tr>${headers.map((h, i) => `<th style="width:${colsPct[i]}%; text-align:left; color:${SOFT}">${h}</th>`).join('')}</tr>${rows.map((r) => `<tr style="background:${SURFACE}">${r.map((c) => `<td style="text-align:left">${c}</td>`).join('')}</tr>`).join('')}</table>`;
const bigNum = (n, unit, desc, c = INK) => card(`<p style="font-family:${DISPLAY}; font-size:96px; font-weight:900; line-height:1; color:${c}">${n}<span style="color:${SOFT}">${unit}</span></p>${ptxt(desc, 28, SOFT)}`, 'flex:1');
const bridge = (t) => `<div style="display:flex; align-items:center; gap:16px; padding:20px 28px; background:${NAVY_SOFT}; border-left:6px solid ${NAVY}; border-radius:10px">${icon('PaperPlane', NAVY)}<p style="font-size:30px; font-weight:600; color:${NAVY}">${t}</p></div>`;

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
section('cover', { pad: '128px 176px', gap: 20, notes: '종합 발표. 라이브 데모 없이 슬라이드로만 진행한다. 순서: Proposal → 요구사항 → 데이터 → 설계 → 기술스택·AI → 4주차 발표 이후 진행 내역. 각 파트가 청중의 질문 하나에 답하고, 파트 끝 문장이 다음 파트의 질문으로 이어지도록 짰다.' },
  dots(1500, 430, 780, 520) +
  `<div style="flex:1"></div>` +
  `<div style="display:flex"><p style="font-family:${MONO}; font-size:24px; letter-spacing:2px; color:${NAVY}; background:${NAVY_SOFT}; border:1px solid ${LINE}; border-radius:999px; padding:8px 24px">SPOISM ERP · PROJECT REVIEW</p></div>` +
  `<h1 style="font-family:${DISPLAY}; font-size:176px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:${INK}">스포이즘 ERP</h1>` +
  `<p style="font-size:52px; font-weight:500; color:${SOFT}">위탁운영 계약을 지키는 관리 시스템</p>` +
  `<div style="height:36px"></div>` +
  `<p style="font-family:${MONO}; font-size:28px; color:${SOFT}"><b>발표자</b>&nbsp; 박정현 &nbsp;&nbsp;·&nbsp;&nbsp; <b>준비일</b>&nbsp; 2026-10-05 &nbsp;&nbsp;·&nbsp;&nbsp; <b>대상</b>&nbsp; 아파트·오피스텔 커뮤니티 시설 위탁운영 ERP</p>` +
  `<div style="flex:1"></div>`);

const agendaRow = (no, name, q) => `<div style="display:flex; align-items:center; gap:28px; padding:18px 28px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:12px"><p style="font-family:${MONO}; font-size:28px; font-weight:700; color:${NAVY}; width:60px">${no}</p><p style="font-family:${DISPLAY}; font-size:34px; font-weight:700; color:${INK}; width:440px">${name}</p><p style="font-size:30px; color:${SOFT}">${q}</p></div>`;
section('agenda', { notes: '목차이자 오늘의 질문 목록. 순서대로 답한다. 마지막 ⑥은 지난 4주차 발표(9/28) 이후 한 일이다.' },
  head('오늘 순서', '여섯 개의 질문에 차례로 답합니다') +
  fill(`<div style="display:flex; flex-direction:column; gap:12px">` +
    agendaRow('01', '프로젝트 Proposal', '이 회사는 무엇이 문제인가') +
    agendaRow('02', '주요 기능 · 요구사항', '그래서 무엇을 만드나') +
    agendaRow('03', '데이터 정의', '그 규칙을 데이터로 어떻게 담나') +
    agendaRow('04', '설계 Diagram', '실제로 어떻게 돌아가나') +
    agendaRow('05', '개발환경 · 기술스택(AI)', '무엇으로, 어떻게 만들었나') +
    agendaRow('06', '4주차 발표 이후', '지난 발표 이후 무엇이 바뀌었나') +
    `</div>`));

// ════════════════════════════════════════════════════════════════════════
// ① Proposal
// ════════════════════════════════════════════════════════════════════════
partSlide('p1', '01', '프로젝트 Proposal', '이 회사는 무엇이 문제인가', '파트 1. 스포이즘이 어떤 회사인지부터 시작한다 — 여기를 잘못 이해하면 이후 설계 전체가 틀어진다.');

section('prop-business', { notes: '핵심 재해석: 스포이즘은 헬스장 체인이 아니라 아파트·오피스텔 커뮤니티 시설 위탁운영사다(RFP Ⅲ~Ⅳ). 전국 98개 업장은 2022년 RFP 작성 시점 기준. 지점은 "소유 매장"이 아니라 입주자대표회의·관리사무소와 맺은 위탁운영 계약 현장이다. 직원도 지점이 고용하지 않고 본사가 채용해 파견한다(RFP "행정 및 트레이너들 역시 해당 지역 또는 본사 파견 형태"). ①계약이 ②③운영의 전제이고, ③에서 쌓인 운영 데이터(회원수·매출·실적)가 다시 ①계약 갱신·영업 근거가 된다. 분석 근거는 RFP와 일반 실무 관행 조사이지 스포이즘 내부 자료가 아니다 — "조사·분석해 설계로 연결했다"까지만 말할 것.' },
  head('스포이즘은 어떤 회사인가', '헬스장 체인이 아니라, 위탁운영 계약 사업입니다') +
  diagramSide(F.bizCycle,
    label('핵심') +
    h3('지점 = 계약 현장', 36) + ptxt('아파트 입주자대표회의와 맺은 위탁운영 계약. 상대방·기간·상태가 있습니다.', 28, INK) +
    h3('직원 = 본사 파견', 36) + ptxt('지점이 고용하지 않습니다. 본사가 채용해 현장에 보냅니다.', 28, INK) +
    h3('전국 98개 현장', 36) + ptxt('RFP 작성 시점(2022) 기준', 26)) +
  foot('근거: 제안요청서 Ⅲ 사업개요 · Ⅳ 과업내용'));

section('prop-problem', { notes: 'RFP가 직접 밝힌, 기존 벤더 ERP를 계속 쓰지 않으려는 이유 4가지. 이 중 4번이 이 프로젝트의 모든 비기능 판단의 기준이 된다 — 안정성은 UX 품질이 아니라 계약 유지 여부와 직결된 사업 리스크다.' },
  head('기존 ERP의 문제', 'RFP가 직접 밝힌, 자체 개발이 필요한 이유') +
  fill(`<div style="display:grid; grid-template-columns:1fr 1fr; gap:20px">` +
    card(label('01') + h3('노하우 노출', 36) + ptxt('매출·영업 노하우가 벤더사에 쌓여 경쟁사가 생기는 구조')) +
    card(label('02') + h3('벤더 의존', 36) + ptxt('벤더가 도산하면 그 피해가 스포이즘의 신뢰 하락으로')) +
    card(label('03') + h3('업무 불일치', 36) + ptxt('범용 시스템이라 위탁운영이라는 사업 특수성에 맞지 않음')) +
    card(label('04', RED) + h3('불안정 → 민원 → 계약 해지', 36) + ptxt('시스템이 흔들리면 위탁 현장 계약이 끊기는 구조', 28, INK), `border:2px solid ${RED}`) +
    `</div>`) +
  foot('근거: 제안요청서 Ⅳ 1. 과업 목적'));

section('prop-goal', { notes: 'RFP는 자체 개발 이유로 "사업공모(스포츠위탁사업) 현장발표(PT)에서 최첨단 회원관리 시스템을 적용할 수 있다는 강점"을 명시한다. 그래서 이 시스템은 내부 운영 도구이면서 신규 수주 영업 도구다(D18, 차별화전략). 결론: 안정성 = 계약 유지 = 본사 매출(계약 개수).' },
  head('목표', '운영 도구이자, 신규 계약을 따내는 영업 도구') +
  fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
    card(icon('Settings', NAVY) + h3('내부 운영 도구') + ptxt('본사는 전 현장을, 지점은 자기 현장만 관리합니다. 운영 데이터가 계약 판단 근거로 올라옵니다.'), 'flex:1') +
    card(icon('Trust', NAVY) + h3('입찰 PT 영업 도구') + ptxt('신규 단지 위탁운영 입찰에서 "검증된 자체 시스템"을 보여주는 무기입니다.'), 'flex:1') +
    `</div>` +
    `<div style="height:28px"></div>` +
    `<div style="display:flex; align-items:center; gap:20px; padding:28px 36px; background:${AMBER_SOFT}; border:2px solid ${AMBER}; border-radius:14px">${icon('Lightbulb', AMBER)}<p style="font-family:${DISPLAY}; font-size:40px; font-weight:800; color:${INK}">그래서 안정성은 품질이 아니라 <span style="color:${AMBER}">본사 매출(계약 개수)</span> 문제입니다</p></div>`) +
  foot('근거: 제안요청서 Ⅳ · D18(자체개발·데이터 주권 원칙)'));

const scopeCol = (k, t, items, c) => card(`<div style="display:flex">${statePill(k, t)}</div>` + bullets(items, 28, k === 'out' ? 'Warning' : 'Check', c), 'flex:1');
section('prop-scope', { notes: '범위 밖 항목은 요구사항추적표 §2-4와 각 도메인 부록 A-8 근거와 다르게 말하지 않는다. 회원 앱은 다음 장에서 이유를 따로 설명한다.' },
  head('개발 범위', '관리자 웹 + API에 집중했습니다') +
  fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
    scopeCol('done', '하는 것', ['관리자 웹(본사·지점 관리자·직원)', 'REST API + 실DB(Supabase Postgres)', '9개 도메인 — 권한·인사·근태·게시판·회원·예약결제·강사프로그램·혼잡도·자원문서', '회원 기능은 API로 구현(웹에서 회원 계정으로 사용)'], GREEN) +
    scopeCol('out', '하지 않는 것', ['회원용 모바일 앱 — 다음 장', '실제 PG 결제 연동(모의 결제로 대체)', '강사 정산 · 감가상각', 'IoT 혼잡도 계측 · 노쇼 자동 처리'], GRAY) +
    `</div>`) +
  foot('범위 제외 근거: 요구사항추적표 §2-4 · 각 도메인 문서 부록 A-8'));

section('prop-memberapp', { notes: '회원 앱 보류 이유(사용자 확인, docs/log/057, D37 §5). 19.6만/일은 실측이 아니라 계산값이다: 98개 지점 × 지점당 일 이용 200명(design-constants ③) × 세션당 요청 10건(⑩, 약한 가정). 처리 성능은 막히는 이유가 아니었다 — 10/4 k6 실측으로 Lambda 동시 실행 상한 10의 실질 처리 한계는 약 50 rps(설계 계산 200 rps는 요청당 50ms 가정이었는데 실측 p50이 약 110ms), 회원 앱 포함 피크는 약 19 rps(계산)라 받을 수는 있다. 다만 여유가 2.5배 남짓이라 회원 앱을 다시 넣으면 처리 한계도 함께 봐야 한다. 막히는 건 요청 "개수" 한도: Workers 무료 10만/일을 넘으면 그날 나머지 요청이 실패한다. Lambda도 월 약 590만 건으로 무료 100만/월을 넘는다. 감당하려면 유료 전환(월 약 $6)이나 인프라를 더 구성해 지금 인프라와 연결해야 하는데, 그러면 개발 범위가 너무 넓어져서 보류했다. 19.6만/일·19 rps는 "계산값", 처리 한계 약 50 rps는 "실측"(docs/log/056)으로 구분해서 말할 것.' },
  head('범위 결정 · 회원 앱 보류', '회원 앱까지 받으면 무료 한도를 넘습니다') +
  diagramSide(F.memberAppBar,
    label('보류한 이유') +
    ptxt('회원 앱을 붙이면 하루 요청이 무료 한도의 두 배가 됩니다. 넘는 순간 그날의 나머지 요청이 <b>실패</b>합니다.', 28, INK) +
    ptxt('감당하려면 유료 전환이나 인프라를 더 구성해 연결해야 하고, <b>개발 범위가 너무 넓어집니다.</b>', 28, INK) +
    label('대신') +
    ptxt('처리량은 실측 한계 약 50 rps로 회원 앱 피크(약 19 rps)를 받을 수 있습니다. 막히는 건 요청 개수입니다. RFP 핵심인 관리자 쪽에 집중하고, 회원 기능은 API로 남겼습니다.', 26)) +
  foot('요청 수는 계산값 — 98개 지점 × 하루 200명 × 세션당 10건 · 처리 한계는 10/4 k6 실측 · 근거: D37 §1·§5, design-constants ⑬'));

// ════════════════════════════════════════════════════════════════════════
// ② 요구사항
// ════════════════════════════════════════════════════════════════════════
partSlide('p2', '02', '주요 기능 · 요구사항', '그래서 무엇을 만드나', '파트 2. 범위를 정했으니 무엇을 만드는지. RFP 요구사항을 도메인으로 옮기고, 그중 절대 깨지면 안 되는 규칙 3개를 뽑는다.');

const tr = (no, req, dom, how) => [`<b>${no}</b>`, req, dom, how];
section('req-trace', { notes: 'RFP Ⅳ 2. 세부 과업 내용 표의 기능 요구 8개(원문 번호 1~8)와 성능 요구 2개(10·11, 원문에 9번은 결번). 자원문서관리는 기능 표가 아니라 과업1 "인적/물적자원 관리 현황"에서 나온 9번째 도메인. 성능 요구는 처음엔 설계 원칙으로 대체했다가(D14) 실제 배포 후 k6로 실측하는 쪽으로 다시 열었다(D24).' },
  head('요구사항 추적', 'RFP 요구 10개를 9개 도메인으로 옮겼습니다') +
  fill(tableCard(table(26, [8, 26, 26, 40], ['#', 'RFP 요구', '도메인', '핵심'], [
    tr('1', '권한관리', '권한관리', '본사·현장·이용자 권한 분리, 퇴사 즉시 차단'),
    tr('2·3', '인사정보 · 근태', '인사정보관리 · 근태관리', '파견 관리, 출퇴근·휴가·업무일지'),
    tr('4', '게시판(공지)', '게시판', '본사→현장, 현장→이용자 게시판'),
    tr('5', '회원관리', '회원관리', '<b>다른 현장 정보 조회 불가</b>'),
    tr('6·7', '예약결제 · 강사프로그램', '예약및결제 · 강사프로그램게시', '회차 예약, 모의 결제, 프로그램 게시'),
    tr('8', '혼잡도관리', '혼잡도관리', '시설별 5단계 혼잡도'),
    tr('과업1', '물적자원 관리', '자원문서관리', '자산·문서·보존기한'),
    tr('10·11', '가용성 · 성능', '전 도메인', 'k6 실측 → 구조 개선'),
  ]))) +
  foot('근거: 제안요청서 Ⅳ 2. 세부 과업 내용 · 요구사항추적표 §1'));

const adj = (from, to) => `<div style="display:flex; align-items:center; gap:20px; padding:22px 28px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:12px"><p style="font-size:30px; color:${SOFT}; width:420px">${from}</p>${icon('PaperPlane', NAVY)}<p style="font-family:${DISPLAY}; font-size:32px; font-weight:700; color:${INK}; width:720px">${to}</p></div>`;
section('req-adjust', { notes: '공통 원칙: 원본 요구사항의 표면적 형태가 아니라 실질적 의도를 파악해, 1인 개발이 가능한 범위 안에서 그 의도를 가장 잘 구현한다. 단, 줄인 영역에서도 핵심 안전장치(지점 격리, 예약 동시성)는 타협하지 않았다. 모의 결제는 상태 전이(대기→승인→환불)를 실물처럼 구현했다. 혼잡도는 체크인 데이터 자동계산 + 관리자 수동 보정 하이브리드(RFP의 30분 반영 요건보다 짧은 5분 주기 설계).' },
  head('요구사항 조정', '원문의 형태가 아니라, 원문의 의도를 구현했습니다') +
  fill(`<div style="display:flex; flex-direction:column; gap:14px">` +
    adj('세부 권한 목록(입력·수정·삭제…)', '역할 4개 고정 + 지점 격리') +
    adj('다단계 결재', '본인 신청 + 관리자 1단계 승인') +
    adj('모바일 PG 결제', '모의 결제 — 상태 전이는 실물처럼') +
    adj('IoT 인원 계측', '체크인 자동계산 + 수동 보정') +
    `</div>` + `<div style="height:20px"></div>` +
    ptxt('줄인 곳에서도 <b>지점 격리와 예약 동시성</b>은 타협하지 않았습니다.', 30, INK, 600)));

const roleCard = (name, who, items, c, soft) => card(`<div style="display:flex">${pill(name, soft, c)}</div>` + ptxt(who, 26) + bullets(items, 26, 'Check', c), 'flex:1');
section('req-roles', { notes: '역할 4개(D1·D12). 채용·재배치는 본사 관리자만(인사 권한 분리 불변식). 주의: 채용·재배치·퇴사 처리는 API로 구현됐지만 직원 화면은 조회 전용이라 "API로 구현, 화면은 후속 과제"라고 말할 것. 회원 기능은 회원 앱이 아니라 회원 계정으로 로그인한 관리자 웹 화면에서 쓴다.' },
  head('역할별 기능', '같은 데이터를, 역할에 따라 다르게 보여줍니다') +
  fill(`<div style="display:flex; gap:16px; align-items:stretch">` +
    roleCard('본사 관리자', '전 현장', ['계약 현황 대시보드', '채용·재배치(API)', '역할 전환'], NAVY, NAVY_SOFT) +
    roleCard('지점 관리자', '자기 현장만', ['회원 등록·관리', '프로그램·회차', '근태 승인·게시판'], GREEN, GREEN_SOFT) +
    roleCard('직원', '본인 것만', ['출퇴근 체크', '휴가 신청', '업무일지'], AMBER, AMBER_SOFT) +
    roleCard('회원', '등록 지점만', ['회차 예약', '모의 결제', '공지·혼잡도'], GRAY, GRAY_SOFT) +
    `</div>`) +
  foot('채용·재배치는 API로 구현, 화면은 후속 과제 · 회원 기능은 회원 계정으로 로그인한 관리자 웹에서 사용'));

const inv = (no, name, rule, how) => card(`<div style="display:flex; align-items:center; gap:16px">${pill(no, NAVY, '#F4F5F3')}${h3(name, 40)}</div>` + ptxt(rule, 30, INK, 600) + ptxt(how, 26), 'flex:1');
section('req-invariants', { notes: '이 프로젝트의 불변식 3개. 코드를 바꿀 때 깨뜨리면 안 되는 것이고, 자동 테스트가 집중적으로 보는 곳이다(branch-isolation, contract-termination, hr-authority spec). 이후 데이터·설계 파트는 모두 이 세 규칙을 어떻게 지키느냐의 이야기다. 계약 "만료"·"갱신임박"은 차단하지 않는다 — 종료만 차단.' },
  head('절대 깨지면 안 되는 규칙', '모든 설계가 이 세 가지에서 나옵니다') +
  fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
    inv('1', '지점 데이터 격리', '지점 관리자는 자기 지점 데이터만 봅니다', 'RFP: "타현장 정보 조회 불가능하게 할 수 있는 권한". 다른 지점 ID로 요청하면 403/404.') +
    inv('2', '계약 종료 지점 차단', '종료된 현장은 신규 활동이 막힙니다', '신규 회원 등록·예약·게시글 작성 409. 과거 기록 조회는 유지.') +
    inv('3', '인사 권한 분리', '채용·재배치는 본사만 합니다', '지점 관리자는 파견된 인력의 일상 관리만. 지점이 직원을 고용하지 않습니다.') +
    `</div>` + `<div style="height:24px"></div>` + bridge('다음 질문: 이 세 규칙을 데이터로 어떻게 담나')) +
  foot('검증: branch-isolation · contract-termination · hr-authority 자동 테스트'));

section('req-shot', { notes: '실제 화면 두 장. 왼쪽: 본사 관리자(정하늘)가 본 서초점 지점 상세 — 계약 상대방·기간·상태·잔여일이 맨 위에 있다(지점 = 계약). 오른쪽: 회원(이수진, 서초점)의 예약 화면 — 회원 앱이 아니라 회원 계정으로 로그인한 관리자 웹이다. 두 캡처 모두 3주차(2026-09-21) 캡처를 재사용했다 — 이후 실DB 전환이 있었지만 이 두 화면 구성은 바뀌지 않았다. 라이브 데모는 없다.' },
  head('구현 화면', '계약이 먼저 보이는 지점 상세, 회원의 예약') +
  `<div style="flex:1; display:flex; gap:24px; align-items:center">` +
  `<div style="display:flex; flex-direction:column; gap:12px">${browser(IMG.branch, '본사 관리자 · /branches/서초점', 1040, 585, '서초점 지점 상세 — 계약 상대방, 계약 기간, 계약 상태, 잔여일과 소속 직원·프로그램')}</div>` +
  `<div style="flex:1; display:flex; flex-direction:column; gap:20px">${browser(IMG.reserve, '회원 · /reservations', 664, 220, '회원 예약 화면 — 예약 가능한 회차와 확정된 내 예약')}` +
  bullets(['지점 상세 맨 위에 <b>계약 정보</b>', '회원은 <b>등록 지점 회차만</b> 예약', '결제 후 상태가 <b>확정</b>으로'], 28) + `</div></div>` +
  foot('2026-09-21 캡처 · 회원 화면은 회원 계정으로 로그인한 관리자 웹(회원 앱 아님)'));

// ════════════════════════════════════════════════════════════════════════
// ③ 데이터
// ════════════════════════════════════════════════════════════════════════
partSlide('p3', '03', '데이터 정의', '그 규칙을 데이터로 어떻게 담나', '파트 3. 사업 구조(계약·파견)와 불변식 3개가 데이터 모델에 어떻게 들어갔는지.');

section('data-core', { notes: '전체 Prisma 모델 31개 중 핵심 7개만 그렸다(공유 엔티티 기준 문서: architecture/entities.md). 지점이 중심이고 계약 정보를 가진다. 직원은 지점에 직접 붙지 않고 파견 기록(StaffAssignment)을 통해 현장에 연결된다. 계정(로그인)과 직원·회원 프로필은 1:1로 분리(D3).' },
  head('핵심 엔티티', '지점(계약)을 중심으로 모든 데이터가 걸립니다') +
  diagramSide(F.dataCore,
    label('읽는 법') +
    bullets(['<b>지점</b>이 중심 — 회원·프로그램이 지점에 속합니다', '<b>직원</b>은 파견 기록을 거쳐 현장에 연결됩니다', '<b>계정</b>은 로그인만, 프로필은 따로(D3)'], 28) +
    ptxt('전체 31개 모델 중 핵심 7개', 26)) +
  foot('기준 문서: architecture/entities.md → apps/api/prisma/schema.prisma'));

const st = (name, d, k) => { const m = { done: [GREEN_SOFT, GREEN], plan: [NAVY_SOFT, NAVY], part: [AMBER_SOFT, AMBER], red: [RED_SOFT, RED] }[k]; return `<div style="flex:1; display:flex; flex-direction:column; gap:10px; padding:28px; background:${m[0]}; border:2px solid ${m[1]}; border-radius:14px"><p style="font-family:${DISPLAY}; font-size:40px; font-weight:800; color:${m[1]}">${name}</p><p style="font-size:26px; line-height:1.4; color:${INK}">${d}</p></div>`; };
section('data-branch', { notes: '지점 엔티티는 이름·주소만 있는 얕은 엔티티였다가, RFP 재해석 후 계약 상대방·계약 기간·계약 상태를 갖게 됐다(D20·D22, entities.md §2-1). 상태 4단계 중 "종료"만 신규 활동을 차단한다. 만료·갱신임박은 차단하지 않는다 — 실무에서 계약 만료 후에도 갱신 협상 중 운영이 이어지는 경우가 있기 때문. 판정은 API 한 곳(지점 서비스의 계약 판정)에서만 한다.' },
  head('지점 = 계약', '지점은 상대방·기간·상태를 가진 계약입니다') +
  fill(card(`<div style="display:flex; gap:40px">` +
      `<div style="flex:1; display:flex; flex-direction:column; gap:10px">${label('계약 상대방')}${ptxt('서초 OO아파트 입주자대표회의', 30, INK, 600)}</div>` +
      `<div style="flex:1; display:flex; flex-direction:column; gap:10px">${label('계약 기간')}${ptxt('2024-03-01 ~ 2027-02-28', 30, INK, 600)}</div>` +
      `<div style="flex:1; display:flex; flex-direction:column; gap:10px">${label('지역')}${ptxt('서울 · 지역별 묶음', 30, INK, 600)}</div>` +
    `</div>`) +
    `<div style="height:24px"></div>` + label('계약 상태 4단계') + `<div style="height:8px"></div>` +
    `<div style="display:flex; gap:14px; align-items:stretch">` +
      st('정상', '모든 활동 가능', 'done') + st('갱신임박', '대시보드에 경고 · 활동 가능', 'part') + st('만료', '갱신 협상 중 · 활동 가능', 'part') + st('종료', '<b>신규 등록·예약·게시 차단(409)</b> · 과거 조회 유지', 'red') +
    `</div>`) +
  foot('근거: entities.md §2-1 · D20 · D22 · 검증: contract-termination 자동 테스트'));

section('data-staff', { notes: '"지점이 직원을 고용한다"는 전제로 코드·문서를 쓰지 않는다(CLAUDE.md 가드레일). 직원은 본사 소속이고 파견 기록이 언제·어느 현장에 있었는지를 남긴다 — 이력이 남으니 재배치해도 과거 근태·업무일지가 원래 지점 기준으로 유지된다. 파견하면 옛 지점 담당 회원 관계가 정리된다(ADR-STF-04). 계정과 프로필 분리(D3): 로그인 주체는 계정 하나, 역할별 상세는 직원·회원 프로필.' },
  head('직원 = 본사 채용 + 현장 파견', '고용은 본사, 근무지는 파견 기록이 정합니다') +
  fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
    card(label('계정') + h3('로그인 주체', 36) + ptxt('이메일 · 비밀번호 · 역할 4개 중 하나. 퇴사·탈퇴하면 즉시 차단됩니다.'), 'flex:1') +
    card(label('직원') + h3('본사 소속 인력', 36) + ptxt('채용·퇴사는 본사만. 지점 관리자도 직원 레코드를 가집니다.'), 'flex:1') +
    card(label('파견 기록', AMBER) + h3('언제, 어느 현장', 36) + ptxt('재배치하면 새 기록이 생기고, 옛 지점 담당 회원 관계는 정리됩니다.'), `flex:1; border:2px solid ${AMBER}`) +
    `</div>`) +
  foot('근거: D3(계정·프로필 분리) · entities.md §2-2 · 인사정보관리 ADR-STF-04'));

section('data-integrity', { notes: '앱 코드의 검사는 사람이 새 쿼리를 짤 때마다 기억해야 하는 약점이 있다. 그래서 DB가 강제할 수 있는 것은 DB로 옮겼다(D27·D28): CHECK 제약 18개(금액·기간·상태 조합), 지점 일치 트리거 7개(예: 프로그램의 강사·시설이 같은 지점인가), 부분 unique(같은 회원·같은 회차 활성 예약 1개). 이걸 만드는 과정에서 실제 결함을 찾았다: 예약 생성이 회원 지점과 프로그램 지점을 비교하지 않아, 회차 ID만 알면 다른 지점 예약이 됐다(수정 전 201 응답 확인) → 403 + 트리거로 막고 격리 테스트에 케이스를 추가했다(docs/log/042).' },
  head('규칙을 DB가 지킨다', '앱 코드만 믿지 않고, 데이터베이스가 직접 막습니다') +
  fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
    bigNum('18', '개', 'CHECK 제약 — 금액·기간·상태 조합') +
    bigNum('7', '개', '지점 일치 트리거 — 연결된 데이터는 같은 지점') +
    bigNum('3', '종', '부분 unique — 같은 회차 중복 예약 등') +
    `</div>` + `<div style="height:24px"></div>` +
    `<div style="display:flex; align-items:center; gap:20px; padding:24px 32px; background:${RED_SOFT}; border:2px solid ${RED}; border-radius:14px">${icon('Warning', RED)}<p style="font-size:30px; font-weight:600; line-height:1.4; color:${INK}">만드는 과정에서 실제 결함 발견 — 회차 ID만 알면 <b>다른 지점 예약이 됐습니다.</b> 지금은 403 + 트리거로 막습니다.</p></div>`) +
  foot('근거: D27 · D28 · docs/log/042 · architecture/data-integrity.md'));

// ════════════════════════════════════════════════════════════════════════
// ④ 설계
// ════════════════════════════════════════════════════════════════════════
partSlide('p4', '04', '설계 Diagram', '실제로 어떻게 돌아가나', '파트 4. 구성도 → 지점 격리 흐름 → 예약 흐름 → 배포 구조가 바뀐 이유.');

section('arch-system', { notes: '지금 운영 경로: 브라우저 → Cloudflare Worker(관리자 웹 정적 파일 + /api 프록시 + 로그인 요청 제한) → AWS Lambda(서울, NestJS API) → Supabase Postgres(서울). 화면과 API를 같은 주소로 묶어 쿠키·CORS 문제를 없앴다. Worker 경유로 로그인과 데이터 조회까지 확인했다. API와 DB가 같은 서울 리전이라 요청마다 쌓이던 리전 간 왕복이 사라졌다. 이전에 쓰던 Render(싱가포르)는 더 이상 운영 경로가 아니다. 참고: 배포 워크플로의 헬스체크는 DB를 거치지 않는 고정 응답이라, DB 연결은 실제 로그인·조회로 확인한 것이다. 10/4 Lambda 위 k6 실측: 로그인 p95 237ms, 50 rps에서 p95 178ms, 넘친 요청은 13ms 안에 거절(docs/log/056). 실질 처리 한계는 약 50 rps.' },
  head('시스템 구성도', '하나의 주소 뒤에 화면·API·DB가 있습니다') +
  diagramSide(F.sysArch,
    label('구성') +
    bullets(['<b>Worker</b>가 화면과 API를 한 주소로 — 로그인 요청 제한도 여기서', '<b>API</b>는 AWS Lambda(서울)', '<b>DB</b>는 Supabase(서울) — API와 같은 리전'], 28) +
    ptxt('Worker 경유 로그인·데이터 조회까지 확인', 26)) +
  foot('이전 운영 경로(Render, 싱가포르)는 Lambda 전환 후 쓰지 않습니다'));

section('arch-isolation', { notes: '지점 격리는 두 겹이다. ③ 공통 가드는 경로·쿼리에 지점 ID가 있으면 내 지점인지 본다. 하지만 /members/:id 같은 단건 라우트는 지점 ID가 경로에 없으므로 ④ 컨트롤러가 꺼낸 데이터의 지점을 직접 확인한다. 존재 자체를 숨겨야 할 때는 404. 지점 단위 라우트를 추가하면 격리 테스트(branch-isolation.spec)의 공격 케이스 표에도 함께 추가하는 것이 규칙이다. 공통 가드로 중앙화하는 안은 사용자 승인 대기.' },
  head('지점 격리 흐름', '요청 하나가 네 관문을 통과해야 처리됩니다') +
  diagramSide(F.isolationFlow,
    label('왜 네 겹인가') +
    ptxt('③은 경로에 지점 ID가 있을 때만 봅니다. <b>단건 조회</b>는 경로에 지점이 없어서 ④가 직접 확인합니다.', 28, INK) +
    label('검증') +
    ptxt('다른 지점 ID로 공격하는 케이스 표를 자동 테스트가 매번 돌립니다.', 28, INK)) +
  foot('검증: apps/api/test/branch-isolation.spec.ts'));

section('arch-reservation', { notes: '예약 흐름(ADR-RSV-01·02, D32). ① 회차 행을 잠가서 동시에 온 요청이 줄을 서게 한다 — 정원 2명인 회차에 동시 요청이 몰려도 정확히 2건만 성공하는 것을 실DB 동시성 테스트로 확인(reservation-capacity.spec). 중복 예약은 앱 검사 + 부분 unique 인덱스 이중화. 결제 승인은 "대기일 때만" 바꾸는 조건부 갱신이라 두 번 눌러도 한 번만 승인된다. 결제는 실제 PG가 아닌 모의 결제(D5). PG 어댑터(ADR-RSV-03)는 설계만 있고 미구현.' },
  head('예약 흐름', '동시에 몰려도 정원을 넘지 않습니다') +
  diagramSide(F.reservationFlow,
    label('핵심') +
    bullets(['회차를 <b>먼저 잠그고</b> 확인 — 동시 요청도 정원만큼만 성공', '종료 지점은 <b>409</b>로 차단', '결제는 <b>한 번만</b> 승인'], 28) +
    ptxt('실DB 동시성 테스트로 확인', 26)) +
  foot('근거: 예약및결제 ADR-RSV-01·02 · 검증: reservation-capacity · contract-termination 테스트'));

const evo = (when, name, d, k) => { const m = { red: [RED_SOFT, RED], done: [GREEN_SOFT, GREEN], part: [AMBER_SOFT, AMBER], plan: [NAVY_SOFT, NAVY] }[k]; return `<div style="flex:1; display:flex; flex-direction:column; gap:12px; padding:28px; background:${m[0]}; border:2px solid ${m[1]}; border-radius:14px"><p style="font-family:${MONO}; font-size:24px; font-weight:700; color:${m[1]}">${when}</p><p style="font-family:${DISPLAY}; font-size:34px; font-weight:800; line-height:1.2; color:${INK}">${name}</p><p style="font-size:26px; line-height:1.4; color:${INK}">${d}</p></div>`; };
section('arch-evolution', { notes: '배포 구조가 바뀐 이유를 원인→결정으로. 9/27 Render 무료 티어에서 k6 실측: 동시 로그인 40명에 로그인 p95 15.16초, 조회 API p95 1.18초(로컬 정상 처리는 65ms). 원인은 공유 CPU 1대에서 "지연→동시 요청 누적→CPU 경합→더 큰 지연" 자기강화 루프(design-constants ⑨). 서버를 늘리려면 메모리 상태(인메모리 mock)를 없애야 해서 실DB 전환(D26~D36)을 먼저 끝냈다. 그 위에서 Lambda: 요청마다 CPU가 따로라 루프의 CPU 고리가 끊기고, 남는 공유 자원인 DB 커넥션은 동시 실행 상한 10으로 보호한다(넘치면 대기열 대신 즉시 거절). Lambda로 운영 전환을 끝내고(Worker 경유 로그인·조회 확인) 10/4에 k6로 다시 쟀다: 동시 로그인 0→40명(1초 간격)에서 로그인 p95 237ms — 9/27의 15.16초 대비 약 1/60. 조건 차이: 이번엔 Function URL에 직접(Worker 로그인 rate limit 때문), 정점에서 상한 10에 닿아 거절 1건(에러 0 기준은 미달). 남은 위험: 요청당 처리 p50 약 110ms(가정 50ms)라 실질 처리 한계 약 50 rps.' },
  head('배포 구조가 바뀐 이유', '실측 → 원인 → 실DB → Lambda → 재측정') +
  fill(`<div style="display:flex; gap:14px; align-items:stretch">` +
    evo('9/27 · 실측', '로그인 p95 15초', 'Render 무료 티어, 동시 40명. 로컬 정상 처리는 65ms', 'red') +
    evo('원인', '공유 CPU 경합', '지연이 요청을 쌓고, 쌓인 요청이 지연을 키우는 루프', 'red') +
    evo('9/28~29 · D26~D36', '실DB 전환', '메모리 상태를 없애야 서버를 늘릴 수 있다', 'done') +
    evo('9/30 이후 · D37', 'Lambda 운영', '서울 리전. 요청마다 CPU 분리 + 동시 실행 상한 10으로 DB 보호', 'done') +
    evo('10/4 · 재측정', '로그인 0.24초', 'p95, 같은 동시 40명. 실질 처리 한계는 약 50 rps', 'done') +
    `</div>`) +
  foot('근거: D24(k6 실측) · D26~D36 · D37 · docs/log/056(Lambda 위 k6) · design-constants ⑨'));

// ════════════════════════════════════════════════════════════════════════
// ⑤ 기술스택 · AI
// ════════════════════════════════════════════════════════════════════════
partSlide('p5', '05', '개발환경 · 기술스택', '무엇으로, 어떻게 만들었나', '파트 5. 스택, 그리고 AI(Claude Code)와 어떻게 협업했고 결과물을 어떻게 검증했는지.');

section('stack', { notes: '스택 선택 근거: 모노레포로 클라이언트-서버 타입 공유(D13). DB는 Supabase(서울) 유지 — Lambda와 같은 AWS 서울 위라 지연 이득이 작고, 이전 비용이 낮아 조건이 생기면 옮긴다(D37 §5). Lambda 배포는 GitHub Actions + OIDC(액세스 키 저장 없음), 헬스체크 실패 시 별칭 롤백. k6는 부하 실측. 관리자 웹은 자동 테스트가 없어 lint·빌드(타입체크)까지만 검증된다.' },
  head('기술스택', '1인 개발이 운영까지 감당할 수 있는 조합') +
  fill(tableCard(table(28, [22, 42, 36], ['영역', '사용 기술', '선택 이유'], [
    ['<b>구조</b>', 'npm workspaces 모노레포', 'API·웹이 타입을 공유(D13)'],
    ['<b>API</b>', 'NestJS · Prisma · TypeScript', '모듈·가드로 권한 규칙 일원화'],
    ['<b>웹</b>', 'React · Vite · React Query', '역할별 화면, 서버 상태 캐시'],
    ['<b>DB</b>', 'Supabase Postgres(서울)', '무료 · 트랜잭션 풀러 · 이전 쉬움'],
    ['<b>엣지</b>', 'Cloudflare Worker', '화면+API 한 주소, 요청 제한'],
    ['<b>호스팅</b>', 'AWS Lambda(서울) · 이전 Render', '요청별 CPU 격리, DB와 같은 리전'],
    ['<b>CI·배포·측정</b>', 'GitHub Actions(OIDC) · k6', '검증 후 배포, 실패 시 롤백'],
  ]))) +
  foot('검증 범위: API는 jest 자동 테스트 · 관리자 웹은 lint·빌드까지(테스트 없음)'));

section('ai-workflow', { notes: '개발은 Claude Code와의 대화로 했다. 사용자가 diff를 매번 보지 않아도 방향을 잡을 수 있도록 "구현 전에 근거를 밝히고, 구현 후 기록한다"를 규칙으로 정했다(CLAUDE.md 구현 작업 원칙, 2026-09-22). architecture-driver 스킬: Driver → 대안 비교 → ADR → 구현 → 검증 → 기록. 이 방법론은 이 프로젝트(근태관리 사이클)에서 먼저 확립돼 범용 스킬로 역이식됐다. wrap-up 스킬: 작업마다 STATUS 덮어쓰기 + 진행 로그 1건 + 결정 기록. 커밋 메시지에는 근거 ID(ADR·D 번호)를 남긴다.' },
  head('AI 협업 방식', 'AI가 구현하고, 근거와 기록을 남기게 했습니다') +
  diagramSide(F.methodCycle,
    label('규칙 · CLAUDE.md') +
    bullets(['구현 <b>전</b>에 근거(ADR·D 번호)를 밝힌다', '구현 <b>후</b> 기록한다 — wrap-up 스킬', '스키마·인증·배포 DB 변경은 <b>사람이 승인</b>'], 28) +
    ptxt('도구: Claude Code + architecture-driver · wrap-up 스킬', 26)) +
  foot('사람은 방향과 승인을, AI는 근거를 인용하며 구현과 기록을 맡았습니다'));

section('ai-verify', { notes: 'AI 결과물을 믿지 않고 기계로 검증한 장치. 커밋 전 hook: apps/·packages/ 변경 시 양쪽 lint·빌드·jest, 문서 변경 시 doc-check. CI: PR·main push에서 같은 검사. jest 범위는 불변식 3개(지점 격리·계약 종료 차단·인사 권한)와 실DB 동시성·도메인 규칙 — API 테스트 파일 27개. 관리자 웹은 테스트가 없다(lint·빌드만). 테스트가 실패하면 기대값을 바꾸지 말고 코드의 규칙 위반으로 보고한다는 규칙도 있다. 결정 38건(D1~D38)·진행 로그 57건은 "왜 그렇게 됐나"를 다음 세션이 따라갈 수 있게 한다.' },
  head('AI 결과물 검증', 'AI가 만든 것을 믿지 않고, 기계로 확인했습니다') +
  fill(`<div style="display:flex; gap:16px; align-items:stretch">` +
    card(icon('Lock', NAVY) + h3('커밋 전 hook', 34) + ptxt('lint · 빌드 · jest가 통과해야 커밋됩니다'), 'flex:1') +
    card(icon('CheckCircle', NAVY) + h3('CI', 34) + ptxt('PR마다 같은 검사 + 문서 검사기'), 'flex:1') +
    card(icon('Verified', NAVY) + h3('테스트 파일 27개', 34) + ptxt('불변식 3개 + 실DB 동시성'), 'flex:1') +
    card(icon('Book', NAVY) + h3('결정 38 · 로그 57', 34) + ptxt('왜 그렇게 됐는지 따라갈 수 있게'), 'flex:1') +
    `</div>` + `<div style="height:24px"></div>` +
    `<div style="display:flex; align-items:center; gap:20px; padding:24px 32px; background:${AMBER_SOFT}; border:2px solid ${AMBER}; border-radius:14px">${icon('Warning', AMBER)}<p style="font-size:28px; line-height:1.4; color:${INK}"><b>한계:</b> 관리자 웹은 자동 테스트가 없어 lint·빌드(타입체크)까지만 검증됩니다.</p></div>`) +
  foot('기준: 커밋 2665ed8 · .claude/hooks/pre-commit-check.js · .github/workflows/ci.yml'));

// ════════════════════════════════════════════════════════════════════════
// ⑥ 4주차 발표 이후
// ════════════════════════════════════════════════════════════════════════
section('ai-docs', { notes: '전체 문서 구조. AI는 세션이 바뀌면 기억이 없으므로, 매번 읽어야 하는 양을 줄이고 같은 사실을 한 곳에만 두도록 문서를 읽는 시점별 세 층으로 나눴다(10/1 재편). ① 매 세션: CLAUDE.md(바뀌지 않는 규칙과 "무엇을 할 때 어디를 읽나" 표, 루트·앱별)와 STATUS.md(지금 상태만, 세션 끝마다 덮어씀, 80줄 상한). ② 작업할 때: 도메인 문서 9개의 맨 위 요약 카드(40줄 상한)부터 읽고 필요하면 결정 절·부록으로 내려간다, 아키텍처 문서는 공유 엔티티(단일 기준)와 날짜·정합성 같은 횡단 규칙. ③ 왜 그렇게 됐는지 따라갈 때만: 결정 기록(결정 하나에 파일 하나, 고치지 않고 새 번호로 대체 — 38건), 진행 로그(작업 한 건에 파일 하나, 추가만 — 59건), 참고 자료(RFP 원본·요구사항 추적표·기업 분석). 코드 주석은 경로가 아니라 결정 번호로 문서를 가리켜, 문서를 옮겨도 깨지지 않는다. 문서 검사기(doc-check)가 커밋 전에 링크·옛 이름·크기 상한·인덱스를 검사한다. 작업을 마칠 때는 wrap-up 스킬이 STATUS 덮어쓰기 + 로그 1건 + 결정 기록을 남긴다.' },
  head('문서 구조', 'AI가 매 세션 이어서 일할 수 있게, 읽는 시점별로 나눴습니다') +
  diagramSide(F.docTiers,
    label('왜 이렇게') +
    ptxt('AI는 세션이 바뀌면 기억이 없습니다. 매번 읽을 양은 줄이고, 필요한 만큼만 더 깊이 들어갑니다.', 28, INK) +
    label('원칙') +
    bullets(['한 사실은 <b>한 곳에만</b>', '지금 상태는 <b>덮어쓰고</b>, 경위는 <b>쌓는다</b>', '코드 주석은 위치가 아니라 <b>번호로</b> 문서를 가리킨다'], 28)) +
  foot('결정 기록 38건 · 진행 로그 59건 · 도메인 문서 9개'));

partSlide('p6', '06', '4주차 발표 이후', '지난 발표 이후 무엇이 바뀌었나', '파트 6. 범위: 4주차 덱 마지막 커밋 c20306d(9/28) 다음부터 8c953ec(10/3)까지 커밋 29개(병합 제외) + Lambda 배포·운영 전환. 서사: 약속 → 실행 → 결정 → 남은 것.');

section('week-promise', { notes: '4주차 발표의 결론을 다시 짚고 시작한다. Render의 한계(공유 CPU, 서울 리전 없음)와 Lambda 전환 방침은 지난 발표에서 이미 말했다. 그때 실DB 전환은 인증 모듈 하나만 끝난 상태였고 Lambda는 계획이었다. 이번 한 주는 그 약속을 실행한 기록이다.' },
  head('지난 발표의 약속', '"실DB로 먼저 바꾸고, Lambda로 옮깁니다"') +
  fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
    card(label('4주차 발표 시점 · 9/28') + bullets(['실DB 전환은 <b>인증 모듈만</b>', '나머지 도메인은 인메모리 mock', 'Lambda는 <b>계획</b>'], 30, 'Clock', AMBER), 'flex:1') +
    card(label('지금 · 10/5', GREEN) + bullets(['실DB 전환 <b>전 도메인 완료</b>', 'mock 코드 삭제', 'Lambda로 <b>운영 전환</b>'], 30, 'Check', GREEN), `flex:1; border:2px solid ${GREEN}`) +
    `</div>`) +
  foot('범위: 4주차 발표 이후 커밋 29개(병합 제외)와 Lambda 배포·전환'));

const chip = (t, k = 'done') => { const m = { done: [GREEN_SOFT, GREEN], plan: [NAVY_SOFT, NAVY], red: [RED_SOFT, RED] }[k]; return `<p style="font-size:28px; font-weight:700; color:${m[1]}; background:${m[0]}; border:1px solid ${m[1]}; border-radius:10px; padding:12px 20px; white-space:nowrap">${t}</p>`; };
const arr = `<x-icon name="PaperPlane" style="color:${SOFT}; width:26px; height:26px"></x-icon>`;
section('week-realdb', { notes: '9/29 하루에 전 도메인을 실DB로 옮겼다. 순서 원칙(D29): "참조되는 쪽부터" — 지점이 없으면 직원 파견을 못 만들고, 회차가 없으면 예약을 못 만든다. 먼저 스키마를 보강하고(D27: 부분 unique, 날짜 KST 정합, 채번·연동 실패 기록 테이블) DB 규칙(D28: CHECK 18·트리거 7)을 깐 뒤 도메인을 차례로 옮겼다. 각 단계마다 Supabase에 시드를 적용하고 로컬과 지문을 비교했다(사용자 승인). 마지막에 MockDataService(2,288줄)를 삭제했다(D36).' },
  head('실행 ① · 9/29', '하루 만에 전 도메인을 실DB로 옮겼습니다') +
  fill(card(label('순서 원칙 — 참조되는 쪽부터(D29)') +
    `<div style="display:flex; flex-wrap:wrap; align-items:center; gap:14px">` +
    [chip('스키마 보강', 'plan'), chip('DB 규칙', 'plan'), chip('지점'), chip('직원·파견'), chip('시설·강사·프로그램'), chip('회원·예약·결제'), chip('근태'), chip('문서'), chip('자산'), chip('게시판'), chip('mock 삭제', 'red')].join(arr) +
    `</div>`) +
    `<div style="height:24px"></div>` +
    `<div style="display:flex; gap:16px; align-items:stretch">` +
    bigNum('9/9', '', '도메인 실DB 전환 완료', GREEN) + bigNum('2,288', '줄', '인메모리 mock 삭제') + bigNum('2→6', '', '마이그레이션 파일') +
    `</div>`) +
  foot('근거: D27 · D28 · D29~D36 · docs/log/040~050'));

section('week-found', { notes: '실DB로 옮겨야 보이는 문제들이었다. ① 다른 지점 예약 결함(log/042): 예약 생성이 회원·프로그램 지점을 비교하지 않았다 — 수정 전 201 응답 확인, 403 + 트리거로 막음. ② DB 규칙이 잡아낸 생성 데이터 결함(log/045): 시드 생성기가 CHECK 제약을 어기는 데이터를 만들고 있었다. ③ 근태(log/047): mock은 Node 단일 스레드라 우연히 맞았던 규칙들(동시 출근 체크 등)을 DB 락으로 다시 보장해야 했다. 메시지: mock에서는 통과했지만 실제 DB·동시성에서는 깨지는 것들.' },
  head('실행 중 발견', '실DB로 옮기자 보이지 않던 문제가 보였습니다') +
  fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
    card(icon('Warning', RED) + h3('다른 지점 예약', 36) + ptxt('회차 ID만 알면 다른 지점 회차를 예약할 수 있었습니다 → 403 + 트리거', 28, INK) + label('log/042', SOFT), `flex:1; border:2px solid ${RED}`) +
    card(icon('Database', AMBER) + h3('규칙 위반 데이터', 36) + ptxt('DB 규칙이 시드 생성기의 잘못된 데이터를 잡아냈습니다', 28, INK) + label('log/045', SOFT), 'flex:1') +
    card(icon('Clock', AMBER) + h3('우연히 맞던 규칙', 36) + ptxt('단일 스레드라 맞았던 근태 규칙을 DB 락으로 다시 보장', 28, INK) + label('log/047', SOFT), 'flex:1') +
    `</div>` + `<div style="height:24px"></div>` +
    ptxt('API 테스트 파일 <b>18개 → 27개</b> — 실DB에서 진짜 동시성을 검증합니다', 30, INK, 600)) +
  foot('근거: docs/log/042 · 045 · 047'));

const rej = (n, d) => `<div style="flex:1; display:flex; flex-direction:column; gap:6px; background:${GRAY_SOFT}; border:1px solid ${LINE_STRONG}; border-radius:10px; padding:16px 20px"><p style="font-size:26px; font-weight:700; color:${SOFT}">${n}</p><p style="font-size:24px; line-height:1.3; color:${SOFT}">${d}</p></div>`;
section('week-lambda', { notes: '지난 발표에서 예고한 Lambda 전환을 어떻게 설계했는지(D37, 9/30). Lambda는 실행 환경 하나가 요청 하나만 처리하므로 요청마다 CPU가 따로다 — 4주차에 본 "지연→요청 누적→CPU 경합" 루프의 CPU 고리가 구조적으로 끊긴다. 남는 공유 자원은 DB 커넥션이라, 동시 실행 상한을 10으로 묶어 DB가 감당하는 만큼만 받고, 넘치는 요청은 대기열에 쌓지 않고 입구에서 바로 거절(503)한다. API를 DB와 같은 서울 리전에 둬서 요청당 쿼리 4~8개의 리전 간 왕복도 없앴다. 계산상 필요한 동시 실행은 약 1.3건, 상한 10의 처리 한계는 약 200 rps로 잡았다(요청당 50ms 가정). 10/4 실측에서는 요청당 처리 p50이 약 110ms라 실질 한계가 약 50~55 rps였다 — 원인(Lambda↔풀러 왕복 × 요청당 쿼리 수)은 추정이고 확인 전. DB는 Supabase를 유지하고, 옮길 조건 4개(용량 80%, 백업 요구, 풀 대기 반복, 회원 앱 재개)를 정해 뒀다.' },
  head('실행 ② · 9/30', '지난 발표에서 예고한 Lambda 전환, 이렇게 설계했습니다') +
  fill(`<div style="display:flex; gap:16px; align-items:stretch">` +
    card(icon('Activity', GREEN) + h3('요청마다 CPU 분리', 34) + ptxt('요청끼리 CPU를 나눠 쓰지 않아, 몰려도 서로를 느리게 만들지 않습니다'), 'flex:1') +
    card(icon('Database', NAVY) + h3('동시 실행 상한 10', 34) + ptxt('DB 커넥션이 감당하는 만큼만 받고, 넘치면 기다리게 하지 않고 바로 거절합니다'), 'flex:1') +
    card(icon('Globe', NAVY) + h3('DB와 같은 서울', 34) + ptxt('요청마다 쿼리 4~8개가 오가던 싱가포르↔서울 왕복이 사라집니다'), 'flex:1') +
    `</div>` + `<div style="height:24px"></div>` +
    ptxt('DB는 Supabase를 유지합니다 — 옮길 조건(용량·백업·풀 대기·회원 앱)을 미리 정해 뒀습니다.', 28, INK, 600)) +
  foot('처리 한계: 설계 계산 약 200 rps(요청당 50ms 가정) → 10/4 실측 약 50 rps(요청당 약 110ms)'));

section('week-memberapp', { notes: '같은 날(9/30) 회원 앱 보류를 결정했다. 파트 1 범위 슬라이드에서 이미 설명했으므로 여기서는 시간순 위치만 짚는다. Lambda로 처리 성능 문제는 풀었지만 요청 개수 한도(무료 티어)는 별개 문제였다 — 회원 앱을 받으려면 유료 전환이나 인프라 추가 구성이 필요하고 범위가 과하게 넓어진다(log/057). 결과: 범위 안 요청량은 하루 1만 건 수준(추정)이라 무료 한도 안에 든다.' },
  head('결정 ② · 9/30', '같은 날, 회원 앱을 보류했습니다') +
  fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
    card(label('Lambda가 푼 것', GREEN) + h3('처리 성능', 36) + ptxt('요청마다 CPU가 따로라, 몰려도 서로를 느리게 만들지 않는 구조', 28, INK), 'flex:1') +
    card(label('Lambda로 안 풀리는 것', RED) + h3('무료 요청 개수 한도', 36) + ptxt('회원 앱을 받으면 하루 19.6만 건 — 엣지 무료 한도 10만 건 초과(계산)', 28, INK), `flex:1; border:2px solid ${RED}`) +
    `</div>` + `<div style="height:24px"></div>` +
    `<div style="display:flex; align-items:center; gap:20px; padding:24px 32px; background:${NAVY_SOFT}; border-left:6px solid ${NAVY}; border-radius:10px">${icon('Lightbulb', NAVY)}<p style="font-size:30px; font-weight:600; line-height:1.4; color:${INK}">인프라를 더 붙이면 범위가 너무 넓어집니다 → <b>관리자 웹 완성에 집중</b></p></div>`) +
  foot('근거: D37 §5 · docs/log/052 · 057'));

section('week-docs', { notes: '10/1 문서 구조 재편(D38). 계기: 이전 세션의 작업이 멈췄던 이유가 "기계 신호가 없어서"였다 — 문서가 커지고 같은 사실이 여러 곳에 있어 어디가 최신인지 알 수 없었다. 바꾼 것: 매 세션 읽는 것(CLAUDE.md·STATUS·요약 카드)과 필요할 때만 여는 것(로그·결정·부록)을 나눈 로딩 계층, 경로가 아니라 ID로 인용(예: ADR-RSV-01, D37), doc-check가 링크·옛 이름·크기 상한을 커밋 전에 검사. AI와 장기 작업을 이어가기 위한 인프라라는 점을 강조.' },
  head('실행 ③ · 10/1', '앞에서 본 문서 구조는 이때 만들었습니다') +
  fill(`<div style="display:flex; gap:16px; align-items:stretch">` +
    card(icon('Book', NAVY) + h3('로딩 계층', 34) + ptxt('매번 읽는 것(STATUS·요약 카드)과 필요할 때만 여는 것(로그·결정)을 나눴습니다'), 'flex:1') +
    card(icon('Link', NAVY) + h3('ID로 인용', 34) + ptxt('경로가 아니라 ADR-RSV-01, D37 같은 ID로 — 옮겨도 안 깨집니다'), 'flex:1') +
    card(icon('Search', NAVY) + h3('문서 검사기', 34) + ptxt('링크·옛 이름·크기 상한을 커밋 전에 기계가 검사합니다'), 'flex:1') +
    `</div>`) +
  foot('근거: D38 · docs/log/053'));

const step = (when, t, k) => { const m = { done: [GREEN_SOFT, GREEN], part: [AMBER_SOFT, AMBER] }[k]; return `<div style="display:flex; align-items:center; gap:24px; padding:20px 28px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:12px"><p style="font-family:${MONO}; font-size:24px; font-weight:700; color:${NAVY}; width:150px">${when}</p><p style="flex:1; font-size:30px; color:${INK}">${t}</p>${pill(k === 'done' ? '완료' : '확인 전', m[0], m[1])}</div>`; };
section('week-infra', { notes: 'Lambda 인프라 구축과 전환. Function URL을 저장소·Actions 로그에서 뺐다(log/054) — 공개 저장소에 주소가 남으면 앱이 거절한 요청도 Lambda 호출로 과금되기 때문. AWS 계정에 함수·URL·OIDC 배포 역할·5분 워밍·경보·예산 경보($1/$5/$20)를 만들었다(log/055). 비밀값은 사용자가 직접 스크립트로 넣었다. 10/4 GitHub Actions 배포: 첫 실행은 AWS 인증 단계에서 실패, 이후 2회 성공(패키징→업로드→버전 발행→별칭 이동→헬스체크). 그다음 Worker가 Lambda를 가리키도록 전환했고, Worker 경유로 로그인과 데이터 조회까지 확인했다. 같은 날 k6로 Lambda 위 성능을 쟀다(S1 로그인 p95 237ms·거절 1, S2 50 rps p95 178ms, S3 300 rps에서 거절 p95 13ms·성공 p95 182ms, 콜드 스타트 Init 1,063ms). 배포 헬스체크는 DB를 거치지 않는 고정 응답이라 DB 연결 확인은 실제 로그인·조회로 한 것이다.' },
  head('실행 ④ · 10/2~', 'Lambda를 만들고, 운영을 옮겼습니다') +
  fill(`<div style="display:flex; flex-direction:column; gap:12px">` +
    step('10/2', 'Function URL을 저장소·로그에서 제거 — 거절된 요청도 과금되기 때문', 'done') +
    step('10/3', 'AWS 리소스 · 배포 역할 · 워밍 · 예산 경보 생성', 'done') +
    step('10/4', 'GitHub Actions 자동 배포 — 검증 후 배포, 실패 시 롤백', 'done') +
    step('전환', 'Worker → Lambda 연결, 로그인·데이터 조회 확인', 'done') +
    step('10/4 · k6', '실측 — 로그인 p95 237ms · 넘친 요청은 13ms 만에 거절', 'done') +
    `</div>`) +
  foot('근거: docs/log/054 · 055 · 056'));

const nx = (k, t, d) => card(`<div style="display:flex">${statePill(k, k === 'done' ? '완료' : k === 'part' ? '다음' : '보류')}</div>` + h3(t, 34) + ptxt(d, 26), 'flex:1');
section('week-next', { notes: 'k6 실측(10/4, docs/log/056) — 통과 기준(D37 §4)과 비교: S1 로그인 p95 237ms(기준 500ms) 통과, 다만 정점에서 상한 10에 닿아 거절 1건이라 에러 0 기준은 미달. S2 50 rps p95 178ms 통과. S3 300 rps에서 넘친 요청 거절 p95 13ms·성공 p95 182ms 통과. 콜드 스타트 Init 1,063ms. 4주차 15.16초 → 0.24초. 남은 것: ① 요청당 처리 p50 약 110ms(가정 50ms)라 실질 처리 한계가 약 50 rps — 원인 확인, 동시 실행 한도 상향이나 쿼리 수 줄이기는 결정 대기. ② Render 정리(일시정지) — 롤백은 Render가 아니라 Lambda 별칭으로 한다. 회원 앱은 보류 상태 그대로.' },
  head('남은 것', 'Lambda 위에서 다시 쟀고, 다음 한계를 찾았습니다') +
  fill(`<div style="display:flex; gap:16px; align-items:stretch">` +
    nx('done', '완료', '실DB 전환 · 문서 재편 · Lambda 운영 전환 · k6 재측정') +
    nx('part', '다음', '처리 한계 약 50 rps의 원인 확인 → Render 정리') +
    nx('out', '보류', '회원 앱 — 유료 전환·인프라 추가가 필요해질 때 다시') +
    `</div>`) +
  foot('10/4 실측: 로그인 p95 237ms(기준 500ms) · 50 rps p95 178ms · 넘친 요청 거절 p95 13ms'));

// ── 마무리 ───────────────────────────────────────────────────────────────
section('closing', { pad: '128px 176px', gap: 24, notes: '맺음 한 줄(말로): "지난주 약속한 실DB 전환과 Lambda 전환을 끝냈고, 다시 재 보니 로그인 15초가 0.24초가 됐습니다. 다음은 처리 한계 약 50 rps의 원인을 찾는 일입니다." Q&A 대비: k6는 Function URL에 직접 쟀음(Worker rate limit 때문), S1 정점 거절 1건, 처리 한계 원인은 추정만, 배포 헬스체크는 DB를 거치지 않음, 19.6만/일은 계산값, 관리자 웹은 테스트 없음, 회원 화면은 관리자 웹 대용, 기업 분석은 내부 자료가 아니라 조사·재구성.' },
  dots(400, 780, 700, 460) + `<div style="flex:1"></div>` +
  `<h1 style="font-family:${DISPLAY}; font-size:176px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:${INK}">감사합니다</h1><p style="font-size:44px; color:${SOFT}">질문 환영합니다.</p><div style="flex:1"></div>`);

// ── 린트 ──────────────────────────────────────────────────────────────────
const problems = [];
for (const s of slides) {
  const noSvg = s.html.replace(/<svg[\s\S]*?<\/svg>/g, '');
  if (/<style|class=|z-index|margin\s*:|var\(|\d\s*em[;"' ]/.test(noSvg)) problems.push(`${s.id}: 허용되지 않은 CSS/속성 의심`);
  if (/<text[\s>]/.test(s.html)) problems.push(`${s.id}: svg 안에 <text>`);
  (noSvg.match(/font-size:(\d+(?:\.\d+)?)px/g) || []).forEach((m) => { if (parseFloat(m.split(':')[1]) < 24) problems.push(`${s.id}: 24px 미만 ${m}`); });
  if ((noSvg.match(/<[a-z-]+/g) || []).length > 200) problems.push(`${s.id}: 요소 200개 초과`);
  (s.html.match(/<svg[\s\S]*?<\/svg>/g) || []).forEach((v) => { if (Buffer.byteLength(v) > 52 * 1024) problems.push(`${s.id}: svg 52KB 초과`); });
  const aside = s.html.match(/<aside>([\s\S]*)<\/aside>/);
  if (aside && aside[1].length > 4000) problems.push(`${s.id}: 노트 4000자 초과`);
  s.kb = (Buffer.byteLength(s.html) / 1024).toFixed(1);
}

fs.mkdirSync(path.join(OUT, 'project', 'slides'), { recursive: true });
for (const s of slides) fs.writeFileSync(path.join(OUT, 'project', 'slides', s.id + '.html'), s.html, 'utf8');
const deck = {
  v: 4,
  createdOnFiles: { v: 1, at: '2026-10-05T00:00:00Z' },
  lists: 'css',
  title: '스포이즘 ERP 프로젝트 발표',
  order,
  sections: {
    intro: { description: '표지와 오늘의 질문 여섯 개', start: 'cover' },
    proposal: { description: '01 Proposal — 위탁운영 계약 사업, 자체 개발 이유, 목표와 범위(회원 앱 보류)', start: 'p1' },
    req: { description: '02 요구사항 — RFP 추적, 의도 중심 조정, 역할, 불변식 3개, 구현 화면', start: 'p2' },
    data: { description: '03 데이터 — 핵심 엔티티, 지점=계약, 직원=파견, DB가 지키는 규칙', start: 'p3' },
    design: { description: '04 설계 — 구성도, 지점 격리, 예약 흐름, 배포 구조 변화', start: 'p4' },
    stack: { description: '05 기술스택·AI — 스택, AI 협업 방식, 결과물 검증, 문서 구조', start: 'p5' },
    week: { description: '06 4주차 발표 이후 — 실DB 전환, Lambda 설계·운영 전환, 회원 앱 보류, 남은 것', start: 'p6' },
    wrap: { description: '마무리', start: 'closing' },
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
console.log('도식 경고:', lib.WARN.length ? lib.WARN.join(' | ') : '없음');
