// 6주차 진행 발표 덱 — 2026-09-28 ~ 10-11 두 주간의 진행과 다음 방향.
// 서사: 실DB·Lambda 위에서 회원 앱을 되살리고 · RFP 남은 요구를 채우고 · 핵심 규칙을 한 곳에 모으고 · 측정으로 병목을 찾았다
//       → 그런데 이 데이터는 이름표뿐이다 → 계약 상태별 5곳을 밀도 있게(계획).
// 라이브 데모 없음. 디자인은 4-0 §4(종합 발표와 같은 언어). 구성안: docs/presentation/4-6_6주차발표_슬라이드구성.md
// 도식은 SVG 없이 카드·막대(div)로만 그렸다 — lib.js·figs가 필요 없다.
// 실행: node viz/deck46.js deck-out   → deck-out/project/{deck.json, slides/*.html}
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
const fill = (inner, extra = '') => `<div style="flex:1; display:flex; flex-direction:column; justify-content:center; ${extra}">${inner}</div>`;
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

// 캡처 자리 — Worker 재배포 전이라 실제 화면을 아직 못 찍었다. 이미지를 합성하지 않고 빈 프레임으로 둔다(4-0 §5).
const shotNote = '캡처 자리 · 재배포 후 실제 화면으로 교체';
const browserPH = (url, w, h, what) =>
  `<div style="display:flex; flex-direction:column; width:${w}px; background:${SURFACE}; border:1px solid ${LINE_STRONG}; border-radius:14px; box-shadow:${SHADOW}; overflow:hidden">` +
  `<div style="display:flex; align-items:center; gap:10px; padding:12px 20px; background:${SURFACE2}; border-bottom:1px solid ${LINE}">` +
  `<div style="width:14px; height:14px; border-radius:50%; background:#D9534F"></div><div style="width:14px; height:14px; border-radius:50%; background:#E0A43A"></div><div style="width:14px; height:14px; border-radius:50%; background:#4CAF6A"></div>` +
  `<p style="font-family:${MONO}; font-size:24px; color:${SOFT}; padding:0px 0px 0px 16px; white-space:nowrap">${url}</p></div>` +
  `<div style="height:${h}px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; background:${GRAY_SOFT}">${icon('Search', GRAY, 48)}<p style="font-size:30px; font-weight:600; color:${INK}">${what}</p><p style="font-family:${MONO}; font-size:24px; color:${GRAY}">${shotNote}</p></div></div>`;
const phonePH = (what, sub) =>
  `<div style="display:flex; flex-direction:column; align-items:center; gap:16px">` +
  `<div style="width:340px; height:620px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; background:${GRAY_SOFT}; border:10px solid ${INK}; border-radius:44px; padding:24px">${icon('Search', GRAY, 44)}<p style="font-family:${MONO}; font-size:24px; color:${GRAY}; text-align:center">캡처 자리</p></div>` +
  `<p style="font-family:${DISPLAY}; font-size:32px; font-weight:700; color:${INK}">${what}</p>${ptxt(sub, 24)}</div>`;

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
section('cover', { pad: '128px 176px', gap: 20, notes: '6주차 진행 발표. 범위는 9/28(월)부터 10/11(일)까지 두 주. 라이브 데모 없이 슬라이드로만. 순서: 지난 발표 이후 기반 되짚기 → 회원 앱 → RFP 요구 → 핵심 규칙 → 성능 → 시연 데이터와 다음 방향. 15분 기준: 도입 1분, 회원 앱 3분, RFP 2분, 규칙 3분, 성능 2분, 데이터·방향 3.5분, 마무리 0.5분.' },
  dots(1500, 430, 780, 520) +
  `<div style="flex:1"></div>` +
  `<div style="display:flex"><p style="font-family:${MONO}; font-size:24px; letter-spacing:2px; color:${NAVY}; background:${NAVY_SOFT}; border:1px solid ${LINE}; border-radius:999px; padding:8px 24px">SPOISM ERP · WEEK 6</p></div>` +
  `<h1 style="font-family:${DISPLAY}; font-size:176px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:${INK}">스포이즘 ERP</h1>` +
  `<p style="font-size:52px; font-weight:500; color:${SOFT}">2주간의 진행과 다음 방향</p>` +
  `<div style="height:36px"></div>` +
  `<p style="font-family:${MONO}; font-size:28px; color:${SOFT}"><b>발표자</b>&nbsp; 박정현 &nbsp;&nbsp;·&nbsp;&nbsp; <b>범위</b>&nbsp; 2026-09-28 ~ 10-11</p>` +
  `<div style="flex:1"></div>`);

const tl = (date, t, d) => `<div style="flex:1; display:flex; flex-direction:column; gap:14px; background:${SURFACE}; border:1px solid ${LINE}; border-top:6px solid ${NAVY}; border-radius:14px; padding:32px; box-shadow:${SHADOW}">${label(date)}${h3(t, 36)}${ptxt(d, 26)}</div>`;
section('recap', { notes: '종합 발표(10/5)에서 이미 말한 내용이라 30초 안에 넘긴다. 실DB 전환: 9/29~9/30, 9개 도메인을 차례로 Prisma(Supabase)로 옮기고 인메모리 mock 삭제(D36). Lambda: 10/5 운영 전환, Render 정지(D37·D42). dev 브랜치: 주 개발·배포 기준을 dev로 정리(D39). 범위 83곳: 지방 15곳을 빼야 회원 기능까지 열어도 엣지 무료 한도(하루 10만) 안(약 9.3만, 계산값)에 든다(D40) — 이것이 다음 파트 회원 앱의 출발점.' },
  head('지난 발표 이후', '기반을 실DB와 Lambda 위로 옮겼습니다') +
  fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
    tl('9/30', '실DB 전환 완료', '9개 도메인을 실제 DB로 옮기고, 메모리 임시 데이터를 지웠습니다') +
    tl('10/5', 'Lambda 운영 전환', 'API를 서울 리전 Lambda로 옮겼습니다') +
    tl('10/6', '개발 브랜치 정리', '개발·배포 기준을 하나의 브랜치로 맞췄습니다') +
    tl('10/6', '범위 83곳', '지방 15곳을 빼, 회원 기능까지 무료 한도 안에 넣었습니다') +
    `</div>`) +
  foot('종합 발표(10/5)에서 다룬 내용 — 짧게 되짚기'));

const agendaRow = (no, name, q) => `<div style="display:flex; align-items:center; gap:28px; padding:20px 28px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:12px"><p style="font-family:${MONO}; font-size:28px; font-weight:700; color:${NAVY}; width:60px">${no}</p><p style="font-family:${DISPLAY}; font-size:34px; font-weight:700; color:${INK}; width:400px">${name}</p><p style="font-size:30px; color:${SOFT}">${q}</p></div>`;
section('agenda', { notes: '오늘의 질문 다섯 개. 앞의 넷은 두 주 동안 한 일, 마지막 하나는 다음 방향이다.' },
  head('오늘 순서', '다섯 개의 질문에 차례로 답합니다') +
  fill(`<div style="display:flex; flex-direction:column; gap:14px">` +
    agendaRow('01', '회원 앱', '보류했던 회원 앱은?') +
    agendaRow('02', 'RFP 요구', 'RFP 중 빠진 건?') +
    agendaRow('03', '핵심 규칙', '깨지면 안 되는 규칙은 더 단단해졌나?') +
    agendaRow('04', '성능', '왜 느렸나?') +
    agendaRow('05', '데이터와 다음 방향', '이 데이터는 진짜인가?') +
    `</div>`));

// ════════════════════════════════════════════════════════════════════════
// ① 회원 앱
// ════════════════════════════════════════════════════════════════════════
partSlide('p1', '01', '회원 앱', '보류했던 회원 앱은?', '파트 1. 지난 발표까지 회원 화면은 회원 계정으로 로그인한 관리자 웹이었다. 이번 두 주에 회원 전용 모바일 웹을 처음부터 만들었다.');

const stackBox = (t, d, bg, bd, c = INK) => `<div style="display:flex; flex-direction:column; align-items:center; gap:4px; padding:20px 24px; background:${bg}; border:2px solid ${bd}; border-radius:12px">${h3(t, 32, c)}${ptxt(d, 24)}</div>`;
const barRow = (name, val, pct, c, valC = '#FFFFFF') => `<div style="display:flex; flex-direction:column; gap:10px">${ptxt(name, 26, INK, 600)}<div style="display:flex; width:640px; height:64px; background:${GRAY_SOFT}; border-radius:8px"><div style="width:${Math.round(640 * pct)}px; height:64px; display:flex; align-items:center; justify-content:flex-end; padding:0px 18px; background:${c}; border-radius:8px"><p style="font-family:${DISPLAY}; font-size:30px; font-weight:800; color:${valC}">${val}</p></div></div></div>`;
section('member-why', { notes: '결정(D40·D41): 네이티브 앱이 아니라 모바일 웹(/m/). 네이티브는 스토어 심사·빌드 파이프라인·인프라가 더 붙는다. 모바일 웹은 관리자 웹과 같은 Cloudflare Worker, 같은 Lambda API, 같은 DB를 쓴다 — 인프라 추가 0. 하루 요청 수는 계산값: 지점당 하루 100명 × 방문당 10건 + 관리자 웹 약 1만 건 = 수도권 83곳 약 9.3만 건, 무료 한도 10만 건 안(여유 약 7%). "계산값"이라고 말할 것.' },
  head('회원 앱 · 결정', '네이티브 앱 대신, 같은 서버에 붙는 모바일 웹') +
  fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
    card(label('하루 요청 수 · 계산값') +
      `<div style="height:8px"></div>` +
      barRow('엣지 무료 한도', '10만', 1, GRAY) +
      barRow('수도권 83곳 + 회원 웹', '약 9.3만', 0.93, GREEN) +
      `<div style="height:8px"></div>` +
      ptxt('회원 기능을 열어도 <b>무료 한도 안</b>에 듭니다.', 28, INK), 'flex:1') +
    card(`<div style="display:flex; justify-content:space-between; align-items:center">${label('구조')}${statePill('done', '인프라 추가 없음')}</div>` +
      `<div style="display:flex; gap:16px"><div style="flex:1; display:flex; flex-direction:column">${stackBox('관리자 웹', '본사 · 지점', SURFACE, LINE_STRONG)}</div><div style="flex:1; display:flex; flex-direction:column">${stackBox('회원 웹', '휴대폰 · 새로 만듦', NAVY_SOFT, NAVY, NAVY)}</div></div>` +
      arrowD() + stackBox('같은 엣지', 'Cloudflare Worker', SURFACE2, LINE_STRONG) +
      arrowD() + stackBox('같은 API · 같은 DB', 'Lambda · Supabase', SURFACE2, LINE_STRONG), 'flex:1') +
    `</div>`) +
  foot('요청 수는 계산값(지점당 하루 100명 · 방문당 10건 가정)'));

const step = (no, t, d) => `<div style="flex:1; display:flex; flex-direction:column; gap:12px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; padding:28px 24px; box-shadow:${SHADOW}">${label(no)}${h3(t, 34)}${ptxt(d, 25)}</div>`;
section('member-flow', { notes: '회원 혼자 처음부터 끝까지 할 수 있다. 가입·연동: 오프라인으로 등록된 회원은 회원번호+전화번호로 본인 확인 후 계정과 연결(PR #40). 홈: 시설 혼잡도와 최근 공지. 예약: 프로그램·회차 조회 후 예약. 결제: 모의 결제(실제 PG 연동은 범위 밖) — 상태는 대기→승인→환불을 실물처럼. 내 예약: 조회·취소, 지난 회차는 예약 불가(ADR-RSV-05). 함께 고친 것: 오프라인에서 앱을 열면 로그인이 풀리던 버그, 틀린 비밀번호가 "로그인 만료"로 보이던 버그. 회원 웹은 자동 테스트가 없다(lint·빌드까지). "테스트로 검증했다"고 말하지 말 것.' },
  head('회원 앱 · 기능', '가입부터 예약 취소까지, 회원 혼자 끝냅니다') +
  fill(`<div style="display:flex; gap:10px; align-items:stretch">` +
    step('01', '가입·연동', '회원번호와 전화번호로 본인 확인') + arrowR() +
    step('02', '홈', '시설 혼잡도와 최근 공지') + arrowR() +
    step('03', '예약', '프로그램과 회차를 골라 예약') + arrowR() +
    step('04', '결제', '모의 결제로 예약 확정') + arrowR() +
    step('05', '내 예약', '조회하고, 필요하면 취소') +
    `</div>` +
    `<div style="height:32px"></div>` +
    bullets(['하단 탭 4개 — 홈 · 예약하기 · 내 예약 · 내 정보', '공지 보기, 내 정보 수정, 비밀번호 변경', '데모 로그인 버튼, 오류마다 "해결:" 안내 한 줄'], 28)) +
  foot('결제는 모의 결제 — 실제 결제 연동은 범위 밖'));

section('member-shot', { notes: '캡처 자리다. Worker 재배포 후 이수진(서초점 회원) 계정으로 휴대폰 폭에서 로그인(데모 버튼)·홈·예약 결제 화면을 찍어 교체한다. 교체 전에 발표하면 "화면은 시연 영상/실기기로 보여 드린다"로 대신한다. 관리자 웹 대용이 아니라 회원 전용 웹이다.' },
  head('회원 앱 · 화면', '휴대폰에서 이렇게 보입니다') +
  fill(`<div style="display:flex; gap:56px; justify-content:center; align-items:flex-start">` +
    phonePH('로그인', '데모 계정 버튼 한 번') +
    phonePH('홈', '혼잡도 · 최근 공지') +
    phonePH('예약 · 결제', '회차 선택 → 모의 결제') +
    `</div>`) +
  foot('회원 이수진(서초점) 계정 · 회원 전용 모바일 웹'));

section('member-app', { notes: 'PWA(D45): 홈 화면에 설치, 오프라인이면 "연결 없음" 화면, 당겨서 새로고침과 앱 같은 화면 전환. 방문 1회당 API 요청 3~11회는 개발 환경에서 화면별로 센 실측값 — 무료 한도 계산에 쓴 가정(10회)과 맞는다. 한계: 실기기 설치는 아직 확인하지 않았다(개발 환경 브라우저 에뮬레이션까지). 로그인 유지 토큰이 브라우저 저장소에 있어 XSS에 약하다(D41에 감수로 기록) — 질문이 나오면 답한다.' },
  head('회원 앱 · 설치와 요청량', '앱처럼 설치되고, 요청량은 가정 안에 있습니다') +
  fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
    card(label('설치형 웹') + h3('홈 화면에서 앱처럼', 44) +
      bullets(['홈 화면에 설치', '연결이 끊기면 "연결 없음" 화면', '당겨서 새로고침 · 앱 같은 화면 전환'], 30), 'flex:1') +
    card(label('방문 1회당 API 요청 · 실측') +
      `<p style="font-family:${DISPLAY}; font-size:144px; font-weight:900; line-height:1; color:${INK}">3~11<span style="font-size:64px; color:${SOFT}">회</span></p>` +
      ptxt('무료 한도를 계산할 때 둔 가정(<b>10회</b>) 근처입니다.', 30, INK), 'flex:1') +
    `</div>`) +
  foot('요청 수는 개발 환경에서 화면별로 측정 · 실기기 설치 확인은 다음 단계'));

// ════════════════════════════════════════════════════════════════════════
// ② RFP 요구
// ════════════════════════════════════════════════════════════════════════
partSlide('p2', '02', 'RFP 요구', 'RFP 중 빠진 건?', '파트 2. 요구사항추적표에 "남은 것"으로 적어 둔 RFP 요구를 하나씩 채웠다.');

const ok = `<span style="color:${GREEN}"><b>구현</b></span>`;
section('req-filled', { notes: '개인정보 가림: 목록에서는 전화번호 가운데를 가림, 상세에서만 전체(ADR-MEM-04). 변경 이력: 역할·퇴사·파견 변경을 같은 트랜잭션에서 기록, 본사만 조회(D44). 열람 기록: 관리자가 상세에서 전화번호를 보면 누가·언제 기록, 1년 보존 — 정리는 수동 SQL(D47). 기록이 실패하면 상세 조회도 실패 — 기록 없이 보는 일이 없다. 도움말: 화면 16개에 역할별 사용 순서, 오류마다 "해결:" 한 줄. 대량 목록: 회원·예약·결제·자산 목록을 서버에서 쪽 단위로(D43). 화면은 자동 테스트가 없다 — API 쪽 규칙만 테스트로 본다.' },
  head('RFP 요구 · 채운 것', '남은 것으로 적어 둔 요구를 화면까지 채웠습니다') +
  fill(tableCard(table(28, [22, 66, 12], ['RFP 요구', '한 일', '상태'], [
    ['<b>개인정보 가림</b>', '목록에서 전화번호를 가립니다 — 회원 · 직원 · 강사', ok],
    ['<b>변경 이력</b>', '역할 · 퇴사 · 파견 변경을 남기고, 본사만 봅니다', ok],
    ['<b>열람 기록</b>', '상세에서 전화번호를 열면 누가 · 언제 봤는지 남깁니다', ok],
    ['<b>화면별 도움말</b>', '화면 16개에 역할별 사용 순서, 오류마다 해결 안내', ok],
    ['<b>대량 목록</b>', '회원 · 예약 · 결제 · 자산 목록을 서버에서 나눠 받습니다', ok],
  ]))) +
  foot('근거: 제안요청서 Ⅳ 2. 세부 과업 · 요구사항추적표 §2'));

section('req-shot', { notes: '캡처 자리. 정하늘(본사) 계정으로 변경 이력 화면에서 "전화번호 열람"과 "파견 종료(계약 종료)" 행이 보이게 찍어 교체한다. 기록 실패 시 상세도 실패 — 기록 없이 개인정보를 보는 경로가 없다(D47).' },
  head('RFP 요구 · 화면', '누가 언제 무엇을 봤는지 남습니다') +
  fill(`<div style="display:flex; gap:40px; align-items:center">` +
    browserPH('admin · 본사 정하늘 · 변경 이력', 1100, 560, '변경 이력 화면') +
    `<div style="flex:1; display:flex; flex-direction:column; gap:20px">` +
    label('이렇게 구현했습니다') +
    bullets(['전화번호 열람 · 파견 변경이 한 목록에', '본사 계정만 조회합니다', '기록이 실패하면 열람도 실패 — 기록 없이 보는 길이 없습니다'], 28) +
    `</div></div>`));

const doneRow = (t, d) => `<div style="display:flex; align-items:center; gap:24px; padding:18px 28px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:12px">${icon('CheckCircle', GREEN, 36)}<p style="font-family:${DISPLAY}; font-size:32px; font-weight:700; color:${INK}; width:400px">${t}</p><p style="flex:1; font-size:28px; color:${SOFT}">${d}</p>${statePill('done', '화면 완료')}</div>`;
section('screens-done', { notes: '지난 발표에서 "API로 구현, 화면은 후속 과제"라고 했던 기능 5개. 인사 채용·파견·퇴사는 직원 상세 화면에서(PR #38). 비밀번호 변경은 관리자·회원 모두, 바꾸면 모든 세션 종료(ADR-AUTH-05), 데모 계정은 잠금. 회원 가입·연동은 회원 웹에서(PR #40). 결근 확정은 배치가 아니라 관리자가 미리보기 보고 확정(ADR-ATT-02, PR #44). 자산 수정은 취득 정보(취득일·금액)를 회계 기록이라 잠그고 이름·위치·메모만(PR #44). 계약 상태 변경은 새로 만든 API에 화면까지 같이(PR #51). 화면은 lint·빌드와 수동 확인까지 — 자동 테스트 없음.' },
  head('API만 있던 기능', "지난 발표의 '화면은 후속 과제' 5개를 모두 화면으로") +
  fill(`<div style="display:flex; flex-direction:column; gap:12px">` +
    doneRow('채용 · 파견 · 퇴사', '본사가 직원 상세에서 처리, 채용 후 로그인 정보 안내') +
    doneRow('비밀번호 변경', '관리자 · 회원 모두, 바꾸면 모든 기기에서 로그아웃') +
    doneRow('회원 가입 · 연동', '회원 앱에서 본인 확인 후 기존 회원과 연결') +
    doneRow('결근 확정', '관리자가 미리보기를 보고 확정') +
    doneRow('자산 정보 수정', '취득 정보는 회계 기록이라 잠그고 나머지만') +
    `</div>` + `<div style="height:20px"></div>` +
    bridge('새로 만든 계약 상태 변경은 처음부터 API와 화면을 함께 만들었습니다', NAVY, NAVY_SOFT, 'Verified')));

// ════════════════════════════════════════════════════════════════════════
// ③ 핵심 규칙
// ════════════════════════════════════════════════════════════════════════
partSlide('p3', '03', '핵심 규칙', '깨지면 안 되는 규칙은 더 단단해졌나?', '파트 3. 지점 격리 · 계약 종료 차단 · 인사 권한 분리 — 이 시스템에서 깨지면 계약이 흔들리는 규칙이다. 이번에는 사람의 기억이 아니라 구조와 테스트가 지키게 했다.');

const miniBox = `<div style="display:flex; align-items:center; justify-content:center; height:72px; background:${AMBER_SOFT}; border:1px solid ${AMBER}; border-radius:8px"><p style="font-family:${MONO}; font-size:24px; color:${AMBER}">검사</p></div>`;
const afterBox = (t, d, bg, bd, c) => `<div style="display:flex; flex-direction:column; gap:6px; padding:20px 24px; background:${bg}; border:2px solid ${bd}; border-radius:12px">${h3(t, 30, c)}${ptxt(d, 24)}</div>`;
section('rule-isolation', { notes: 'D46. 전: 지점 검사가 컨트롤러 약 10곳에 복사돼 있었고, 새 화면·라우트가 검사를 빠뜨려도 막을 장치가 없었다. 후: 모든 요청이 지나는 공통 검사 한 곳 + 라우트마다 "무슨 리소스인지" 선언 한 줄. 선언이 빠진 라우트는 실제 라우트 표를 훑는 테스트가 실패시킨다. 변이 확인: 시설 수정의 선언 하나를 일부러 빼면 선언 누락 검사 1건 + 격리 공격 2건, 테스트 3건이 실패했다(log/095). 부수 효과: 남의 지점 id를 주면 조용히 자기 지점으로 바꿔 주던 목록들(자산·결제·근태 요약 등)이 이제 거부한다 — 화면은 남의 지점 id를 보내지 않아 영향 없음.' },
  head('지점 격리', '검사를 10곳에서 1곳으로 모았습니다') +
  fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
    card(pillRow(statePill('part', '전')) + h3('컨트롤러마다 따로', 36) +
      `<div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:12px">${miniBox.repeat(10)}</div>` +
      ptxt('새 기능이 검사를 빠뜨려도 <b>막을 장치가 없었습니다</b>.', 28, INK), 'flex:1') +
    card(pillRow(statePill('done', '후')) + h3('공통 검사 한 곳', 36) +
      afterBox('모든 요청이 지나는 검사 1곳', '지점이 맞는지 여기서만 봅니다', NAVY_SOFT, NAVY, NAVY) +
      afterBox('라우트마다 선언 한 줄', '"이 요청은 어떤 리소스인가"', SURFACE, LINE_STRONG, INK) +
      afterBox('선언이 빠지면 테스트 실패', '실제 라우트 목록을 훑어 찾습니다', GREEN_SOFT, GREEN, GREEN), 'flex:1') +
    `</div>` + `<div style="height:20px"></div>` +
    bridge('검사 하나를 일부러 빼 보니, 테스트 3건이 실패했습니다', GREEN, GREEN_SOFT, 'Verified')));

const chain = (no, t, d, c = NAVY, soft = SURFACE) => `<div style="flex:1; display:flex; flex-direction:column; gap:12px; background:${soft}; border:2px solid ${c}; border-radius:14px; padding:28px 24px">${label(no, c)}${h3(t, 32)}${ptxt(d, 25)}</div>`;
section('rule-contract', { notes: 'ADR-STF-07·08. 프로젝트 규칙 문서에 "설계만 있고 미구현"으로 남아 있던 항목을 해소했다. 본사가 지점을 계약 종료로 바꾸면 같은 트랜잭션에서: 그 지점 진행 중 파견 종료 → 그 직원들이 맡던 회원 담당 해제 → 재배치 대기 목록. 중간에 실패하면 전부 되돌린다. 동시에 들어온 채용·발령과 충돌하지 않게 지점 행을 잠근다 — 잠금을 빼면 동시 요청 테스트가 5회 중 5회 실패하는 것을 확인했다. 계약 종료 지점 직원은 본사도 퇴사 처리 가능. 과거 조회는 그대로. 만료·갱신 임박은 차단하지 않는다.' },
  head('계약 종료', '계약이 끝나면, 인력 배치도 한 번에 정리됩니다') +
  fill(`<div style="display:flex; gap:10px; align-items:stretch">` +
    chain('01', '본사가 계약 종료', '지점 상세에서 상태 변경') + arrowR() +
    chain('02', '파견 종료', '그 지점에 나가 있던 직원 전원') + arrowR() +
    chain('03', '담당 회원 해제', '그 직원들이 맡던 회원') + arrowR() +
    chain('04', '재배치 대기', '본사 직원 목록에 따로 표시', GREEN, GREEN_SOFT) +
    `</div>` + `<div style="height:28px"></div>` +
    `<div style="display:flex; gap:20px; align-items:stretch">` +
    card(icon('Lock', NAVY) + h3('한 번에, 끝까지', 34) + ptxt('네 단계가 하나의 처리입니다. 중간에 실패하면 전부 되돌립니다.', 28, INK), 'flex:1') +
    card(icon('Users', NAVY) + h3('동시 요청에도 안전하게', 34) + ptxt('같은 순간 들어온 채용 · 발령과 겹치지 않게 지점을 잠급니다. 잠금을 빼면 테스트가 <b>5번 중 5번</b> 실패합니다.', 28, INK), 'flex:1') +
    `</div>`));

section('rule-shot', { notes: '캡처 자리. 정하늘(본사) 계정, 지점 상세 → 계약 상태 변경 모달의 "계약 종료" 안내 화면을 찍는다. 실제 종료 처리는 하지 말 것(운영 DB에 저장된다). 모달은 종료 전에 영향(파견 종료·재배치 대기)을 먼저 보여 주고, 처리 후에는 결과 화면(재배치 대기 직원·담당이 풀린 회원)으로 바뀐다. 계약 종료를 되돌릴 수는 있지만 끝난 파견은 되살아나지 않는다.' },
  head('계약 종료 · 화면', '본사는 지점 상세에서 계약 상태를 바꿉니다') +
  fill(`<div style="display:flex; gap:40px; align-items:center">` +
    browserPH('admin · 본사 정하늘 · 지점 상세', 1100, 560, '계약 상태 변경 화면') +
    `<div style="flex:1; display:flex; flex-direction:column; gap:20px">` +
    label('이렇게 구현했습니다') +
    bullets(['종료 전에 무엇이 바뀌는지 먼저 보여 줍니다', '처리 결과로 재배치 대기 직원과 담당이 풀린 회원을 바로 보여 줍니다', '되돌릴 수 있지만, 끝난 파견은 되살리지 않습니다'], 28) +
    `</div></div>`));

// ════════════════════════════════════════════════════════════════════════
// ④ 성능
// ════════════════════════════════════════════════════════════════════════
partSlide('p4', '04', '성능', '왜 느렸나?', '파트 4. 10/4 k6 실측에서 요청당 처리 시간이 설계 가정(50ms)의 두 배(약 110ms)였다. 추정하지 않고 쟀다.');

const perfBar = (name, val, w, c) => `<div style="display:flex; flex-direction:column; gap:10px">${ptxt(name, 26, INK, 600)}<div style="display:flex; align-items:center; gap:18px"><div style="width:${w}px; height:72px; background:${c}; border-radius:8px"></div><p style="font-family:${DISPLAY}; font-size:44px; font-weight:800; color:${c}">${val}</p></div></div>`;
const pstep = (k, t, d, c = NAVY) => `<div style="display:flex; gap:18px; align-items:flex-start"><p style="font-family:${MONO}; font-size:24px; font-weight:700; color:${c}; width:120px">${k}</p><div style="flex:1; display:flex; flex-direction:column; gap:4px">${h3(t, 30)}${ptxt(d, 24)}</div></div>`;
section('perf', { notes: 'D48·D49. 출발점: 10/4 k6 — 요청당 처리 약 110ms(가정 50ms), 실질 처리 한계 약 50 rps. 측정: 로컬에 왕복 지연을 넣어 홈 조회 4종을 재 보니 평균 DB 왕복 20.5회. 원인: 트랜잭션 풀러 호환 모드가 작업마다 시작·정리·종료를 덧붙여 왕복이 약 3.5배, 인증만으로 요청마다 왕복 10회. 대응 1단계(적용): 인증 조회를 하나로, 목록 조회를 묶음(D48). 2단계(준비 완료, 운영 전환 전): Session pooler로 접속 변경 → 왕복 약 6회, 처리 한계 약 2배(50→100 rps) 예상(D49). 주의: 100 rps와 "약 6회"는 계산값이다. 운영 전환과 k6 재측정은 아직 안 했다 — "두 배 빨라졌다"고 말하지 말 것.' },
  head('성능 · 원인', '쿼리 수가 아니라, DB에 붙는 방식이 문제였습니다') +
  `<div style="position:absolute; right:96px; top:84px; display:flex">${statePill('part', '처리 한계 2배는 예상치')}</div>` +
  fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
    card(label('홈 조회 1번에 오가는 DB 왕복') +
      `<div style="height:12px"></div>` +
      perfBar('지금 접속 방식', '20.5회', 640, AMBER) +
      `<div style="height:8px"></div>` +
      perfBar('바꿀 접속 방식', '약 6회', 188, GREEN) +
      `<div style="height:8px"></div>` +
      ptxt('작업마다 시작 · 정리 · 종료가 붙어 왕복이 약 <b>3.5배</b>였습니다. 로그인 확인만 10회.', 28, INK), 'flex:1.2') +
    card(label('측정 → 원인 → 대응') +
      pstep('측정', '요청당 약 110ms', '설계 가정(50ms)의 두 배') +
      pstep('원인', 'DB 왕복이 너무 많음', '쿼리가 아니라 접속 방식 탓') +
      pstep('대응', '조회 묶기 · 접속 방식 전환', '묶기는 적용, 전환은 준비 완료') +
      pstep('남은 것', '운영 전환 후 다시 재기', '2배는 그때 확인합니다', AMBER), 'flex:1') +
    `</div>`) +
  foot('왕복 횟수: 로컬에 지연을 넣어 홈 조회 4종 평균 · "약 6회"와 처리 한계 2배는 계산값'));

// ════════════════════════════════════════════════════════════════════════
// ⑤ 데이터와 다음 방향
// ════════════════════════════════════════════════════════════════════════
partSlide('p5', '05', '데이터와 다음 방향', '이 데이터는 진짜인가?', '파트 5. 여기서부터는 한 일이 아니라 다음 방향이다. 지금 시연 데이터를 정직하게 보여 주고, 왜 방향을 바꾸는지 말한다.');

const na = `<span style="color:${GRAY}">없음</span>`;
section('data-honest', { notes: '시드 코드에서 센 값(apps/api/src/fixtures). 서초점·강남점은 데모 로그인 계정이 물려 있는 손으로 채운 지점, 나머지 81곳은 생성기가 만든 지점이다. 생성 지점은 직원 1~3명, 회원 0~4명, 강사 1명, 프로그램 1~2개. 예약·결제·출결 이력은 어느 지점에도 시드로 넣지 않았다 — 시연 중에 만든 것만 있다. 83곳이 운영된다고 말하지만, 한 지점 안에서 회원·직원·예약이 얽히는 장면은 보여 줄 수 없다.' },
  head('시연 데이터', '83곳 대부분은 이름표입니다') +
  fill(tableCard(table(30, [34, 18, 18, 30], ['지점', '직원', '회원', '예약 · 결제 이력'], [
    ['<b>서초점</b> (데모)', '2명', '2명', na],
    ['<b>강남점</b>', '1명', '1명', na],
    ['<b>나머지 81곳</b>', '1~3명', '0~4명', na],
  ])) + `<div style="height:28px"></div>` +
    bridge('지점 수는 많지만, 한 지점 안에서 회원 · 직원 · 예약이 얽히는 장면은 보여 줄 수 없습니다', AMBER, AMBER_SOFT, 'Warning')) +
  foot('시드 코드 기준(2026-10-11) · 이력은 시연 중 직접 만든 것만 있음'));

const flowLine = (items, c) => `<div style="display:flex; flex-direction:column; gap:10px">${items.map((t, i) => (i ? arrowD(c) : '') + `<div style="padding:18px 24px; background:${SURFACE}; border:2px solid ${c}; border-radius:12px"><p style="font-size:30px; font-weight:600; color:${INK}; text-align:center">${t}</p></div>`).join('')}</div>`;
section('data-why', { notes: '이번 방향 전환의 판단 근거. 83곳으로 정한 이유는 무료 한도(하루 10만 요청)였다. 그런데 실제 서비스를 하려면 어차피 인프라에 투자가 들어가고, 그때 한도는 돈으로 푸는 문제라 의미가 없어진다. 실제로 쓰이려면 한 지점이 밀도 있고 빠르고 불편 없이 돌아가는 시스템이 먼저이고, 규모는 그 위에서 늘리는 것이 맞다고 판단했다. 범위 결정(83곳)을 뒤집는 것이 아니라, 시연 데이터의 초점을 바꾸는 것이다 — 지점 격리·처리 한계 측정 같은 규모 대비 설계는 그대로 둔다.' },
  head('왜 바꾸나', '무료 한도는 시연의 제약이지, 서비스의 기준이 아닙니다') +
  fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
    card(pillRow(statePill('out', '지금까지')) + h3('한도에 맞춘 규모', 36) + flowLine(['무료 한도 하루 10만', '83곳으로 넓게', '지점마다 얕은 데이터'], LINE_STRONG), 'flex:1') +
    card(pillRow(statePill('plan', '실서비스라면')) + h3('쓰이는 시스템이 먼저', 36) + flowLine(['인프라 투자는 전제', '한도는 돈으로 푸는 문제', '한 지점이 불편 없이'], NAVY), 'flex:1') +
    `</div>` + `<div style="height:28px"></div>` +
    `<div style="display:flex; align-items:center; gap:20px; padding:28px 36px; background:${NAVY}; border-radius:14px">${icon('Lightbulb', '#F4F5F3', 36)}<p style="font-family:${DISPLAY}; font-size:38px; font-weight:800; color:#F4F5F3">밀도 있고 빠르고 불편 없는 시스템을 먼저, 규모는 그 위에서 늘립니다</p></div>`));

const branchCard = (k, st, name, sc) => `<div style="flex:1; display:flex; flex-direction:column; gap:14px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; padding:28px 24px; box-shadow:${SHADOW}">${pillRow(statePill(k, st))}${h3(name, 32)}${ptxt(sc, 25, INK)}</div>`;
section('data-plan', { notes: '계획이다 — 아직 만들지 않았다. 지점을 계약 상태별로 하나씩, 정상은 두 곳(서초·강남, 격리 확인용). 지점마다 직원 4~6명, 회원 30~60명, 2~3개월치 예약·결제·출결 이력. 각 지점에 확인할 장면을 붙였다: 정상 A — 아침 동시 입장, 결제 중 관리자 취소, 몰림 시간 처리량 / 정상 B — 지점 격리, 파견 이동 중 근태 귀속, 두 기기 동시 로그인 / 갱신 임박 — 본사 집계 성능, 실적 데이터 신선도 / 만료 — 차단하지 않는 경계 / 계약 종료 — 종료와 채용·발령 동시 요청, 과거 조회. 점검 목록은 docs/architecture/engineering-risks.md(동시성·멱등성·부분 실패 등 17개 범주). 배포 DB를 다시 채우는 일은 별도 승인을 받는다.' },
  head('다음 방향 · 계획', '계약 상태별 5곳을, 밀도 있게') +
  `<div style="position:absolute; right:96px; top:84px; display:flex">${statePill('part', '계획')}</div>` +
  fill(`<div style="display:flex; gap:16px; align-items:stretch">` +
    branchCard('done', '정상', '서초점', '아침 동시 입장 · 결제 중 취소') +
    branchCard('done', '정상', '강남점', '지점 격리 · 두 기기 동시 로그인') +
    branchCard('part', '갱신 임박', '지점 C', '본사 집계 · 실적 신선도') +
    branchCard('out', '만료', '지점 D', '막지 않아야 할 경계') +
    branchCard('navy', '계약 종료', '지점 E', '종료와 채용의 동시 요청') +
    `</div>` + `<div style="height:20px"></div>` +
    ptxt('지점마다 <b>직원 4~6명 · 회원 30~60명 · 2~3개월 이력</b>', 30, INK) +
    `<div style="height:12px"></div>` +
    bridge('기능을 늘리기보다, 동시에 몰리고 · 두 번 오고 · 느려질 때도 맞게 도는지를 시나리오로 확인합니다', NAVY, NAVY_SOFT, 'Activity') +
    `<div style="height:12px"></div>` +
    `<div style="display:flex"><div style="display:flex; align-items:center; gap:14px; padding:14px 22px; background:${GRAY_SOFT}; border-radius:10px">${icon('Lock', GRAY, 28)}<p style="font-size:26px; color:${INK}">규모를 견디는 설계(지점 격리 · 처리 한계 측정)는 그대로 둡니다</p></div></div>`));

// ── 마무리 ───────────────────────────────────────────────────────────────
section('closing', { pad: '128px 176px', gap: 24, notes: '맺음 한 줄(말로): "두 주 동안 회원 앱을 만들고, RFP 남은 요구를 채우고, 핵심 규칙을 한 곳에 모으고, 느린 원인을 찾았습니다. 다음 두 주는 지점을 줄이고 밀도를 올려, 실제로 문제가 터지는 상황을 찾아 풀겠습니다." Q&A 대비: 회원 웹·관리자 웹은 자동 테스트 없음(lint·빌드·수동 확인), API 자동 테스트는 실DB로 격리·계약·인사·동시성·도메인 규칙을 본다. 처리 한계 2배와 왕복 약 6회는 계산값, 운영 재측정 전. 하루 요청 수는 계산값. PWA 실기기 설치 미확인. 열람 기록 정리는 수동 SQL. 5곳 고밀도화는 계획 — 배포 DB 재시드는 승인 후.' },
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
  createdOnFiles: { v: 1, at: '2026-10-11T00:00:00Z' },
  lists: 'css',
  title: '스포이즘 ERP 6주차 발표',
  order,
  sections: {
    intro: { description: '표지, 지난 발표 이후 기반, 오늘의 질문 다섯 개', start: 'cover' },
    member: { description: '01 회원 앱 — 모바일 웹 결정, 기능 흐름, 화면, 설치와 요청량', start: 'p1' },
    rfp: { description: '02 RFP 요구 — 채운 요구 5개, 변경 이력 화면, 화면 후속 과제 5개 완료', start: 'p2' },
    rules: { description: '03 핵심 규칙 — 지점 격리 중앙화, 계약 종료 연쇄 처리와 화면', start: 'p3' },
    perf: { description: '04 성능 — DB 왕복 측정으로 찾은 원인과 대응', start: 'p4' },
    data: { description: '05 데이터와 다음 방향 — 이름표뿐인 83곳, 방향 전환의 근거, 계약 상태별 5곳 계획', start: 'p5' },
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
