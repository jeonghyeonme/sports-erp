// 중간보고서 덱(읽는 덱) — 지도교수가 혼자 넘겨 읽는다(D67). 구성안: docs/presentation/4-7_중간발표_슬라이드구성.md
// 디자인은 6주차 생성기(../../4-6_6주차발표/deck-source/viz/deck46.js)와 같은 언어 — 색·글꼴·카드·알약을 그대로 옮겼다.
// 1차(2026-10-23): 표지 + Ⅱ장의 맞물림 지도·시나리오 3개(흐름 2 + 화면 2 + 회원 1)를 먼저 만들어 확인받는다.
// 실행: node viz/deck47.js deck-out   → deck-out/project/{deck.json, slides/*.html}
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
const title = (t) => `<h2 style="font-family:${DISPLAY}; font-size:56px; font-weight:700; line-height:1.15; letter-spacing:-1px; color:${INK}">${t}</h2>`;
const head = (e, t) => eyebrow(e) + title(t);
const foot = (t) => `<p style="position:absolute; left:96px; bottom:40px; width:1728px; font-size:24px; color:${SOFT}">${t}</p>`;
const fill = (inner, extra = '') => `<div style="flex:1; display:flex; flex-direction:column; justify-content:center; gap:28px; ${extra}">${inner}</div>`;
const pill = (t, bg, color, extra = '') => `<p style="font-family:${BODY}; font-size:24px; font-weight:600; color:${color}; background:${bg}; border-radius:999px; padding:4px 16px; white-space:nowrap; ${extra}">${t}</p>`;
const label = (t, c = NAVY) => `<p style="font-family:${MONO}; font-size:24px; font-weight:600; letter-spacing:2px; color:${c}">${t}</p>`;
const h3 = (t, size = 40, c = INK) => `<h3 style="font-family:${DISPLAY}; font-size:${size}px; font-weight:700; line-height:1.25; color:${c}">${t}</h3>`;
const ptxt = (t, size = 28, c = SOFT, w = 400) => `<p style="font-size:${size}px; font-weight:${w}; line-height:1.45; color:${c}">${t}</p>`;
const icon = (n, c, s = 30) => `<x-icon name="${n}" style="color:${c}; width:${s}px; height:${s}px"></x-icon>`;
const bridge = (t, c = NAVY, soft = NAVY_SOFT, ic = 'Lightbulb') => `<div style="display:flex; align-items:center; gap:18px; padding:20px 28px; background:${soft}; border-left:6px solid ${c}; border-radius:10px">${icon(ic, c)}<p style="font-size:28px; font-weight:600; line-height:1.4; color:${c}">${t}</p></div>`;

// 업로드한 캡처(아티팩트 자산 — 원본은 ../screenshots/). 로컬 실행 화면(시연 데이터), 배포본 아님.
const IMG = {
  hqDash: '/_blob/78acee0262cf858e28fc63e135793479', // scn-hq-dashboard.png 1440×900 (2026-10-23)
  hqMapo: '/_blob/1f6466bac38b92a60384ed80dc648fe8', // after-qa.png 2880×1800 (2026-10-22)
  hqSupport: '/_blob/612738ff3aaffb008a36f7e5b55c0923', // after-support.png 2880×1800 (2026-10-22)
  brMember: '/_blob/4c8ad807a9bb1a237a50307a0e806a60', // ov-scope-admin.png 2880×1800 (2026-10-22)
  brTimetable: '/_blob/ca9dc716fc4e108235f1af60fec0efc1', // scn-branch-timetable.png 1180×300 (2026-10-23, 주간 시간표 부분)
  brAttendance: '/_blob/14267ee00e0065c0a7d5d3cdcc95ee95', // scn-branch-attendance.png 1440×900 (2026-10-23)
  mSlot: '/_blob/c75b81dc5d45f0a2cf09b77c8894dd42', // ov-scope-member-1-slot.png 1170×1992 (2026-10-22)
  mPay: '/_blob/cbb0150e0e8bf97af75554718d7e2238', // ov-scope-member-2-pay.png 1170×1992 (2026-10-22)
  mHome: '/_blob/cf65176e67a7d5ee458c08403f0617d7', // scn-member-home.png 824×1404 (2026-10-23, 홈 위쪽)
};
const browser = (src, url, w, h, alt) =>
  `<div style="display:flex; flex-direction:column; width:${w}px; background:${SURFACE}; border:1px solid ${LINE_STRONG}; border-radius:14px; box-shadow:${SHADOW}; overflow:hidden">` +
  `<div style="display:flex; align-items:center; gap:10px; padding:10px 18px; background:${SURFACE2}; border-bottom:1px solid ${LINE}">` +
  `<div style="width:12px; height:12px; border-radius:50%; background:#D9534F"></div><div style="width:12px; height:12px; border-radius:50%; background:#E0A43A"></div><div style="width:12px; height:12px; border-radius:50%; background:#4CAF6A"></div>` +
  `<p style="font-family:${MONO}; font-size:24px; color:${SOFT}; padding:0px 0px 0px 12px; white-space:nowrap">${url}</p></div>` +
  `<img src="${src}" alt="${alt}" style="width:${w}px; height:${h}px; object-fit:contain; background:${SURFACE}"></div>`;
const shot = (frame, cap, sub) => `<div style="display:flex; flex-direction:column; gap:12px">${frame}${h3(cap, 30)}${ptxt(sub, 24)}</div>`;
const phone = (src, what, sub) =>
  `<div style="display:flex; flex-direction:column; align-items:center; gap:12px">` +
  `<div style="display:flex; background:${INK}; border-radius:40px; padding:10px; box-shadow:${SHADOW}"><img src="${src}" alt="회원 앱 ${what} 화면" style="width:300px; height:511px; object-fit:contain; border-radius:30px; background:${SURFACE}"></div>` +
  `<p style="font-family:${DISPLAY}; font-size:30px; font-weight:700; color:${INK}">${what}</p>${ptxt(sub, 24)}</div>`;

// ── 도메인 색 — 맞물림 지도와 시나리오 알약이 같은 색을 쓴다 ──
// 계약(지점) 남색 · 인력(인사·근태·자원문서) 앰버 · 회원 서비스(회원·예약·프로그램·혼잡도) 그린 · 소통(게시판·업무지원) 회색
const G = { contract: [NAVY, NAVY_SOFT], staff: [AMBER, AMBER_SOFT], member: [GREEN, GREEN_SOFT], talk: [GRAY, GRAY_SOFT] };
const DOMAIN = {
  계약: 'contract', 권한: 'contract', 인사: 'staff', 근태: 'staff', 자원문서: 'staff',
  회원: 'member', 예약결제: 'member', 프로그램: 'member', 혼잡도: 'member', 게시판: 'talk',
};
const NAME = { 계약: '지점·계약', 권한: '세부 권한', 인사: '인사정보', 근태: '근태', 자원문서: '자원·문서', 회원: '회원', 예약결제: '예약·결제', 프로그램: '강사·프로그램', 혼잡도: '혼잡도', 게시판: '게시판·업무지원' };
const dpill = (k) => { const [c, s] = G[DOMAIN[k]]; return pill(NAME[k], s, c); };

// ════════════════════════════════════════════════════════════════════════
// 표지
// ════════════════════════════════════════════════════════════════════════
function dots(cx, cy, rx, ry, gap = 40) {
  const g = { a: [], b: [], c: [] };
  for (let x = gap / 2; x < 1920; x += gap) for (let y = gap / 2; y < 1080; y += gap) {
    const t = Math.hypot((x - cx) / rx, (y - cy) / ry);
    if (t < 1) g[t < 0.4 ? 'a' : t < 0.7 ? 'b' : 'c'].push(`<circle cx="${x}" cy="${y}" r="2.4"/>`);
  }
  const grp = (k, o) => `<g fill="${LINE_STRONG}" fill-opacity="${o}">${g[k].join('')}</g>`;
  return `<svg aria-label="장식용 점 격자" viewBox="0 0 1920 1080" width="1920" height="1080" style="position:absolute; left:0px; top:0px; width:1920px; height:1080px">${grp('c', 0.22)}${grp('b', 0.4)}${grp('a', 0.62)}</svg>`;
}
section('cover', { pad: '128px 176px', gap: 20, notes: '중간고사 대체 제출 "프로젝트 중간보고서". 발표 없이 혼자 넘겨 읽는 덱이다. 함께 낸 파일: RFP 이행 증빙(PDF), 주차별 발표자료, 산출물.' },
  dots(1500, 430, 780, 520) +
  `<div style="flex:1"></div>` +
  `<div style="display:flex"><p style="font-family:${MONO}; font-size:24px; letter-spacing:2px; color:${NAVY}; background:${NAVY_SOFT}; border:1px solid ${LINE}; border-radius:999px; padding:8px 24px">SPOISM ERP · 중간보고</p></div>` +
  `<h1 style="font-family:${DISPLAY}; font-size:150px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:${INK}">스포이즘 ERP</h1>` +
  `<p style="font-size:48px; font-weight:500; color:${SOFT}">아파트·오피스텔 커뮤니티 시설 위탁운영 관리 시스템 — 중간보고서</p>` +
  `<div style="height:36px"></div>` +
  `<p style="font-family:${MONO}; font-size:28px; color:${SOFT}"><b>작성</b>&nbsp; 박정현 &nbsp;&nbsp;·&nbsp;&nbsp; <b>기준일</b>&nbsp; 2026-10-23</p>` +
  `<div style="flex:1"></div>`);

// ════════════════════════════════════════════════════════════════════════
// Ⅱ-6 맞물림 지도 — 위 띠(계약)가 아래 모든 활동의 전제, 아래 띠(세부 권한)가 모든 화면을 덮는다
// ════════════════════════════════════════════════════════════════════════
const NODE_H = 120;
const node = (k, x, y, w, sub) => {
  const [c, s] = G[DOMAIN[k]];
  return `<div style="position:absolute; left:${x}px; top:${y}px; width:${w}px; height:${NODE_H}px; display:flex; flex-direction:column; justify-content:center; gap:4px; background:${SURFACE}; border:2px solid ${c}; border-left:10px solid ${c}; border-radius:12px; padding:0px 20px; box-shadow:${SHADOW}">` +
    `<p style="font-family:${DISPLAY}; font-size:32px; font-weight:700; color:${c}">${NAME[k]}</p><p style="font-size:24px; color:${SOFT}">${sub}</p></div>`;
};
const tag = (x, y, w, t, c = INK, bg = BG) => `<p style="position:absolute; left:${x}px; top:${y}px; width:${w}px; font-size:24px; font-weight:600; line-height:1.3; color:${c}; background:${bg}">${t}</p>`;
// 화살표는 선 + 머리 삼각형(SVG, 글자 없음). 좌표는 슬라이드 기준.
function arrows(list) {
  const parts = list.map(([x1, y1, x2, y2, c, dash]) => {
    const a = Math.atan2(y2 - y1, x2 - x1), L = 18, W = 9;
    const bx = x2 - L * Math.cos(a), by = y2 - L * Math.sin(a);
    const p1 = `${(bx + W * Math.sin(a)).toFixed(1)},${(by - W * Math.cos(a)).toFixed(1)}`;
    const p2 = `${(bx - W * Math.sin(a)).toFixed(1)},${(by + W * Math.cos(a)).toFixed(1)}`;
    return `<line x1="${x1}" y1="${y1}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${c}" stroke-width="4"${dash ? ' stroke-dasharray="10 8"' : ''}/><polygon points="${x2},${y2} ${p1} ${p2}" fill="${c}"/>`;
  });
  return `<svg aria-label="도메인 사이 연결 화살표" viewBox="0 0 1920 1080" width="1920" height="1080" style="position:absolute; left:0px; top:0px; width:1920px; height:1080px">${parts.join('')}</svg>`;
}
{
  const T = 470, B = 710; // 윗줄·아랫줄 노드의 top
  const band = (y, h, c, s, inner) => `<div style="position:absolute; left:96px; top:${y}px; width:1728px; height:${h}px; display:flex; align-items:center; gap:20px; background:${s}; border:2px solid ${c}; border-radius:12px; padding:0px 28px">${inner}</div>`;
  const RED_ISH = '#9B2C2C';
  section('ctx-map', { notes: '이 그림 하나만 기억하면 된다. 위 띠: 지점은 소유 매장이 아니라 위탁운영 계약 현장이다. 계약 상태가 종료면 그 지점의 신규 활동(회원 등록·예약·게시글 작성·채용·파견 발령)이 막히고(409), 과거 조회는 유지된다. 만료·갱신 임박은 막지 않는다. 계약을 종료로 바꾸면 같은 처리 안에서 그 지점의 진행 중 파견이 끝나고 직원은 재배치 대기로 간다. 가운데: 본사가 채용해 지점에 파견한 직원의 근태는 그날 파견된 지점에 귀속되고, 퇴사하면 인사서류 보존기한이 다시 계산된다. 회원은 등록 지점의 프로그램 회차만 예약하고(모의 결제), 진행 중 강습의 예약 인원은 혼잡도에 바로 더해진다. 회원·예약·결제가 쌓인 운영 실적은 지점 상세에서 본사가 계약 갱신을 판단하는 근거가 된다(순환). 게시판은 본사→현장, 현장→회원 두 갈래이고 현장→본사는 업무지원 요청이다. 아래 띠: 세부 권한(기능 15개 × 조회·입력·수정·삭제·출력)이 모든 화면에 걸리고, 판정은 서버가 한다. 지점 관리자는 자기 지점 데이터만 본다.' },
    head('Ⅱ. 맥락 · 한 장으로 보는 맞물림', '계약이 모든 활동의 전제, 실적은 다시 계약으로') +
    arrows([
      [261, 330, 261, T - 2, RED_ISH, true], // 계약 → 인사(채용·발령 차단)
      [725, 330, 725, T - 2, RED_ISH, true], // 계약 → 회원(등록 차단)
      [1659, 330, 1659, T - 2, RED_ISH, true], // 계약 → 게시판(작성 차단)
      [960, B, 960, 332, NAVY], // 예약·결제 → 계약(운영 실적 → 갱신 판단)
      [246, T + NODE_H, 246, B - 2, AMBER], // 인사 → 근태
      [400, T + NODE_H, 540, B - 2, AMBER], // 인사 → 자원·문서(퇴사 → 보존기한)
      [830, T + NODE_H, 830, B - 2, GREEN], // 회원 → 예약
      [1075, T + NODE_H, 1075, B - 2, GREEN], // 프로그램 → 예약
      [1110, B + 60, 1492, B + 60, GREEN], // 예약 → 혼잡도
    ]) +
    band(240, 90, NAVY, NAVY_SOFT,
      `<p style="font-family:${DISPLAY}; font-size:32px; font-weight:800; color:${NAVY}; white-space:nowrap">지점 = 위탁 계약</p>` +
      `<p style="font-size:26px; color:${INK}">정상 · 갱신 임박 · 만료 · <b>종료</b> — 종료면 신규 활동 차단, 과거 조회는 유지</p>`) +
    tag(276, 380, 220, '채용·발령 차단', RED_ISH) +
    tag(740, 380, 170, '등록 차단', RED_ISH) +
    tag(975, 380, 300, '운영 실적 → 갱신 판단', NAVY) +
    tag(1674, 380, 150, '작성 차단', RED_ISH) +
    node('인사', 96, T, 330, '본사 채용 → 지점 파견') +
    node('회원', 560, T, 330, '지점 회원·수강·PT') +
    node('프로그램', 1030, T, 330, '종목·강사·회차') +
    node('게시판', 1494, T, 330, '공지 · 현장 요청') +
    tag(262, 630, 130, '근태 귀속', AMBER) +
    tag(600, 630, 215, '등록 회원만', GREEN) +
    tag(1090, 630, 230, '회차를 열면', GREEN) +
    node('근태', 96, B, 300, '출퇴근·휴가·일지') +
    node('자원문서', 430, B, 300, '자산 · 보존기한') +
    node('예약결제', 780, B, 330, '회차 예약 · 모의 결제') +
    tag(1150, B + 12, 320, '진행 중 강습 인원', GREEN) +
    node('혼잡도', 1494, B, 330, '시설별 5단계') +
    band(870, 70, NAVY, SURFACE,
      `${icon('Lock', NAVY, 30)}<p style="font-family:${DISPLAY}; font-size:28px; font-weight:800; color:${NAVY}; white-space:nowrap">세부 권한</p>` +
      `<p style="font-size:26px; color:${INK}">모든 화면 — 기능 15개 × 조회·입력·수정·삭제·출력, 판정은 서버 · 지점 관리자는 자기 지점만</p>`) +
    foot('색: 남색 계약·권한 · 앰버 인력 · 그린 회원 서비스 · 회색 소통 — 다음 시나리오 장의 알약도 같은 색'));
}

// ════════════════════════════════════════════════════════════════════════
// Ⅱ-7~11 시나리오 — 흐름 장(단계 5개 + 지나가는 도메인 알약) → 화면 장
// ════════════════════════════════════════════════════════════════════════
const step = (no, t, d, ds) =>
  `<div style="flex:1; display:flex; flex-direction:column; gap:14px; background:${SURFACE}; border:1px solid ${LINE}; border-top:6px solid ${NAVY}; border-radius:14px; padding:28px 24px; box-shadow:${SHADOW}">` +
  label(String(no).padStart(2, '0')) + h3(t, 32) + ptxt(d, 25) +
  `<div style="flex:1"></div><div style="display:flex; flex-wrap:wrap; gap:8px">${ds.map(dpill).join('')}</div></div>`;
const flowRow = (steps) => `<div style="display:flex; gap:14px; align-items:stretch">${steps.map((s) => step(...s)).join('')}</div>`;

section('scn-hq-flow', { notes: '본사 관리자(정하늘)의 하루. ① 대시보드 처리 대기함에 갱신 임박·만료 지점, 처리할 업무지원 요청, 재배치 대기 직원 수가 먼저 뜬다. ② 채용은 본사만 한다 — 임시 비밀번호가 발급되고 첫 로그인에서 바꿔야 한다. 파견 발령도 본사만, 계약 종료 지점으로는 발령할 수 없다. ③ 지점 관리자가 올린 업무지원 요청을 처리중 → 완료/반려(반려는 답변 필수)로 처리한다. ④ 지점 상세의 운영 실적(최근 3개월 회차 매출·환불·예약·이용 완료·신규 회원)으로 갱신 여부를 판단한다. ⑤ 계약 상태를 종료로 바꾸면 같은 처리 안에서 그 지점의 진행 중 파견이 끝나고, 직원은 재배치 대기 목록으로 간다. 근거: 인사정보관리 ADR-STF-07·08, 업무지원 D56, 처리 대기함 D61.' },
  head('Ⅱ. 맥락 · 시나리오 ① 본사의 하루', '계약을 보고, 사람을 보내고, 실적으로 다시 계약을 판단합니다') +
  fill(flowRow([
    [1, '갱신 임박 지점 확인', '대시보드 처리 대기함에 갱신 임박·만료 지점이 먼저 뜬다', ['계약']],
    [2, '직원 채용·파견', '채용과 파견 발령은 본사만. 종료 지점으로는 발령 불가', ['인사', '계약']],
    [3, '업무지원 요청 처리', '현장이 올린 요청을 완료 또는 반려(답변 필수)', ['게시판']],
    [4, '운영 실적으로 갱신 판단', '지점 상세의 최근 3개월 매출·예약·신규 회원', ['회원', '예약결제', '계약']],
    [5, '계약 종료 시 정리', '진행 중 파견을 함께 끝내고 재배치 대기로', ['계약', '인사']],
  ]) + bridge('지점 관리자는 이 화면들을 못 엽니다 — 채용·재배치·계약 변경은 본사만 합니다', NAVY, NAVY_SOFT, 'Lock')));

section('scn-hq-shots', { notes: '왼쪽: 본사 대시보드 — 처리 대기(업무지원 요청 4건·계약 갱신 임박·만료 지점 2곳·재배치 대기 직원·보존기한 임박 문서)와 지점 목록(계약 상태 알약). 가운데: 마포점(갱신 임박) 지점 상세 — 계약 정보와 최근 3개월 운영 실적. 오른쪽: 업무지원 요청 처리 창 — 처리중·완료·반려와 답변. 모두 로컬 실행 화면(시연 데이터)이다.' },
  head('Ⅱ. 맥락 · 시나리오 ① 화면', '본사가 보는 세 화면') +
  fill(`<div style="display:flex; gap:24px; align-items:flex-start">` +
    shot(browser(IMG.hqDash, '/ 대시보드', 560, 350, '본사 대시보드 — 처리 대기와 지점 목록'), '① 대시보드', '처리 대기 · 지점별 계약 상태') +
    shot(browser(IMG.hqMapo, '/branches/branch-mapo', 560, 350, '마포점 지점 상세 — 계약 정보와 운영 실적'), '④ 마포점 상세', '갱신 임박 · 최근 3개월 운영 실적') +
    shot(browser(IMG.hqSupport, '/support-requests', 560, 350, '업무지원 요청 처리 창'), '③ 업무지원 요청', '처리중 → 완료 / 반려(답변 필수)') +
    `</div>`) +
  foot('로컬 실행 화면 · 시연 데이터(계약 상태별 5개 지점) — 배포본과 같은 코드'));

section('scn-branch-flow', { notes: '지점 관리자(김민수, 서초점)의 하루. ① 회원 등록 — 계약 종료 지점이면 막힌다. 회원 번호는 지점별로 자동. ② 프로그램의 강습 회차를 열면 회원 앱에서 예약할 수 있고, 주간 시간표에서 예약 현황을 본다. ③ 직원 출퇴근과 휴가 신청을 승인하고, 빠진 날은 정정·등록한다(변경 이력에 남는다). ④ 처리 대기함이 오늘 할 일(휴가 승인·인사 변경 신청·결근 확정 등) 건수를 메뉴 배지로 보여 준다. ⑤ 시설 고장 같은 일은 본사에 업무지원 요청을 올린다. 근거: 예약 달력 ADR-RSV-06, 근태 정정 ADR-ATT-04, 처리 대기함 D61, 업무지원 D56.' },
  head('Ⅱ. 맥락 · 시나리오 ② 지점의 하루', '자기 지점의 회원·강습·직원을 돌보고, 필요한 것은 본사에 요청합니다') +
  fill(flowRow([
    [1, '회원 등록', '등록 지점이 정해지고, 종료 지점이면 막힌다', ['회원', '계약']],
    [2, '강습 회차 열기', '회차를 열면 회원 앱에서 예약, 주간 시간표로 현황', ['프로그램', '예약결제']],
    [3, '출퇴근·휴가 승인', '빠진 날은 정정·등록, 기록은 변경 이력에', ['근태']],
    [4, '처리 대기함 비우기', '오늘 할 일 건수가 메뉴 배지로 보인다', ['근태', '인사', '예약결제']],
    [5, '본사에 업무지원 요청', '시설 고장·인력 요청을 올리고 답을 받는다', ['게시판']],
  ]) + bridge('다른 지점 회원이나 직원은 주소를 알아도 열리지 않습니다 — 서버가 지점마다 막습니다', NAVY, NAVY_SOFT, 'Lock')));

section('scn-branch-shots', { notes: '왼쪽: 회원 상세 — 위쪽 경로 표시(홈 › 회원 서비스 › 회원 › 회원 상세)는 RFP의 "페이지 위치 정보"를 해석한 것(D51). 인적사항·수강·PT 남은 횟수·예약·결제 탭. 가운데: 예약 관리의 주간 시간표 — 요일별 회차와 예약 인원/정원. 오른쪽: 근태관리 — 오늘 출퇴근 현황과 휴가 승인. 로컬 실행 화면.' },
  head('Ⅱ. 맥락 · 시나리오 ② 화면', '지점 관리자가 보는 세 화면') +
  fill(`<div style="display:flex; gap:24px; align-items:flex-start">` +
    shot(browser(IMG.brMember, '/members/:id', 560, 350, '회원 상세 — 경로 표시와 탭'), '① 회원 상세', '경로 표시 · 수강·PT·예약·결제') +
    shot(browser(IMG.brTimetable, '/reservations', 560, 350, '예약 관리 주간 시간표'), '② 주간 시간표', '요일별 회차 · 예약 인원/정원') +
    shot(browser(IMG.brAttendance, '/attendance', 560, 350, '근태관리 — 출퇴근과 휴가 승인'), '③ 근태관리', '출퇴근 현황 · 휴가 승인') +
    `</div>`) +
  foot('로컬 실행 화면 · 서초점 지점 관리자 계정'));

const mstep = (no, t, d, ds) =>
  `<div style="display:flex; gap:18px; align-items:flex-start; background:${SURFACE}; border:1px solid ${LINE}; border-left:6px solid ${GREEN}; border-radius:12px; padding:18px 22px">` +
  label(String(no).padStart(2, '0'), GREEN) +
  `<div style="flex:1; display:flex; flex-direction:column; gap:6px">${h3(t, 30)}${ptxt(d, 24)}<div style="display:flex; flex-wrap:wrap; gap:8px">${ds.map(dpill).join('')}</div></div></div>`;
section('scn-member', { notes: '회원(이수진, 서초점)은 휴대폰 웹 앱(홈 화면에 설치 가능)을 쓴다. 관리자 웹에는 회원이 로그인할 수 없다(D66). ① 등록 지점의 프로그램 회차를 날짜 띠에서 고른다(종목·시간대·연령대 필터). ② 유료 회차는 결제해야 확정된다 — 실제 카드가 아닌 모의 결제(승인 번호 MOCK-…), 시작 24시간 전까지 취소하면 전액 환불. ③ 홈의 혼잡도는 "약 N명/정원 · 강습 a + 현장 b" — 진행 중 강습의 예약 인원은 바로 더해지고, 예약 없이 온 인원은 지점 직원이 입력한다(ADR-FAC-05). 30분 넘게 입력이 없으면 경고. ④ 공지는 다니는 지점·시설 것만 보인다.' },
  head('Ⅱ. 맥락 · 시나리오 ③ 회원의 하루', '휴대폰으로 예약하고, 붐비는지 보고, 공지를 받습니다') +
  `<div style="flex:1; display:flex; gap:40px; align-items:center">` +
    `<div style="width:640px; display:flex; flex-direction:column; gap:14px">` +
      mstep(1, '회차 고르기', '등록 지점 프로그램만, 날짜 띠에서', ['프로그램']) +
      mstep(2, '예약·결제', '모의 결제, 24시간 전 취소는 전액 환불', ['예약결제']) +
      mstep(3, '혼잡도 확인', '진행 중 강습 예약 + 현장 입력 인원', ['혼잡도', '예약결제']) +
      mstep(4, '공지 보기', '다니는 지점·시설 공지만', ['게시판']) +
    `</div>` +
    `<div style="flex:1; display:flex; gap:28px; justify-content:center">` +
      phone(IMG.mSlot, '회차 선택', '날짜 띠 · 남은 자리') +
      phone(IMG.mPay, '결제', '모의 카드 결제') +
      phone(IMG.mHome, '홈 혼잡도', '강습 + 현장 · 입력 시각') +
    `</div>` +
  `</div>` +
  foot('회원 모바일 웹(/m/) · 로컬 실행 화면 — 회원은 관리자 웹에 로그인할 수 없다'));

// ── 린트(6주차와 같은 기준) ─────────────────────────────────────────────────
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
  createdOnFiles: { v: 1, at: '2026-10-23T00:00:00Z' },
  lists: 'css',
  title: '스포이즘 ERP 중간보고서',
  order,
  sections: {
    intro: { description: '표지', start: 'cover' },
    context: { description: 'Ⅱ 맥락 — 한 장으로 보는 맞물림, 본사·지점·회원의 하루', start: 'ctx-map' },
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
