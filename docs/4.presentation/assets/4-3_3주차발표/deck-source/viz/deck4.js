// 3주차 발표 덱 v3 — "RFP 3가지, 지금 어디까지 왔는가"
// 흐름: 표지 → 3가지 한눈에 → (기업 분석 자료) → (개발 작업계획서) → (ERP 앱, 도메인 9장) → 남은 일 → 마무리
// 디자인: 2주차 발표자료(cea04fa5)의 언어 — 웜 그레이 + 네이비 + 앰버 / Gothic A1 · Noto Sans KR · JetBrains Mono
const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const D = require('./figs-d');
lib.setMode('slide');

const OUT = process.argv[2];
const IMG51 = '/_blob/47cc0b82904e39047b6cb9020de840b5'; // 5-1 기업 분석 자료 화면
const IMG52 = '/_blob/2e474d5552d90ffc18b1e04e40aaa7f0'; // 5-2 개발 작업계획서 화면
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
const title = (t) => `<h2 style="font-family:${DISPLAY}; font-size:60px; font-weight:700; line-height:1.15; letter-spacing:-1px; color:${INK}">${t}</h2>`;
const head = (e, t) => eyebrow(e) + title(t);
const foot = (t) => `<p style="position:absolute; left:96px; bottom:40px; width:1728px; font-size:24px; color:${SOFT}">${t}</p>`;
const fill = (inner, extra = '') => `<div style="flex:1; display:flex; flex-direction:column; justify-content:center; ${extra}">${inner}</div>`;
const card = (inner, extra = '') => `<div style="display:flex; flex-direction:column; gap:16px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; padding:40px; box-shadow:${SHADOW}; ${extra}">${inner}</div>`;
const pill = (t, bg, color, extra = '') => `<p style="font-family:${MONO}; font-size:24px; font-weight:600; color:${color}; background:${bg}; border-radius:999px; padding:4px 18px; ${extra}">${t}</p>`;
const label = (t) => `<p style="font-family:${MONO}; font-size:24px; font-weight:600; letter-spacing:2px; color:${NAVY}">${t}</p>`;
const check = `<x-icon name="Check" style="color:${GREEN}; width:30px; height:30px"></x-icon>`;

// 점 격자(2주차 표지·마무리)
function dots(cx, cy, rx, ry, gap = 40) {
  const g = { a: [], b: [], c: [] };
  for (let x = gap / 2; x < 1920; x += gap) for (let y = gap / 2; y < 1080; y += gap) {
    const t = Math.hypot((x - cx) / rx, (y - cy) / ry);
    if (t < 1) g[t < 0.4 ? 'a' : t < 0.7 ? 'b' : 'c'].push(`<circle cx="${x}" cy="${y}" r="2.4"/>`);
  }
  const grp = (k, o) => `<g fill="${LINE_STRONG}" fill-opacity="${o}">${g[k].join('')}</g>`;
  return `<svg aria-label="장식용 점 격자" viewBox="0 0 1920 1080" width="1920" height="1080" style="position:absolute; left:0px; top:0px; width:1920px; height:1080px">${grp('c', 0.22)}${grp('b', 0.4)}${grp('a', 0.62)}</svg>`;
}

// ── 1 표지 ────────────────────────────────────────────────────────────────
section('cover', { pad: '128px 176px', gap: 20, notes: '3주차 진행상황 발표(15분). 시간 배분: 도입 1분 30초 ·  기업 분석 자료 2분 ·  개발 작업계획서 2분 ·  ERP 앱(도메인 9개) 7분 · 마무리 1분 30초.' },
  dots(1500, 430, 780, 520) +
  `<div style="flex:1"></div>` +
  `<div style="display:flex"><p style="font-family:${MONO}; font-size:24px; letter-spacing:2px; color:${NAVY}; background:${NAVY_SOFT}; border:1px solid ${LINE}; border-radius:999px; padding:8px 24px">SPOISM ERP · PROGRESS REPORT</p></div>` +
  `<h1 style="font-family:${DISPLAY}; font-size:176px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:${INK}">스포이즘 ERP</h1>` +
  `<p style="font-size:52px; font-weight:500; color:${SOFT}">3주차 진행상황 발표</p>` +
  `<div style="height:36px"></div>` +
  `<p style="font-family:${MONO}; font-size:28px; color:${SOFT}"><b>발표자</b>&nbsp; 박정현 &nbsp;&nbsp;·&nbsp;&nbsp; <b>준비일</b>&nbsp; 2026-09-21 &nbsp;&nbsp;·&nbsp;&nbsp; <b>대상</b>&nbsp; 아파트·오피스텔 커뮤니티 시설 위탁운영 ERP</p>` +
  `<div style="flex:1"></div>`);

// ── 2 3가지 한눈에 ────────────────────────────────────────────────────
const dcard = (chip, name, desc, status, note) =>
  card(`<h3 style="font-family:${DISPLAY}; font-size:48px; font-weight:700; line-height:1.2; color:${INK}">${name}</h3><p style="font-size:30px; line-height:1.5; color:${SOFT}">${desc}</p><div style="flex:1"></div><div style="display:flex">${pill(status, GREEN_SOFT, GREEN)}</div><p style="font-size:26px; line-height:1.45; color:${SOFT}">${note}</p>`, 'flex:1');
section('deliverables', { notes: '원본 RFP가 요구한 산출물은 세 가지다. 발표 순서는 분석 → 계획 → 구현이다. 주의: 산출물 2는 RFP상 3개 파트(현황 분석, 도입 후 기대효과 분석, 유사기업 매뉴얼 분석)인데 현황 분석 파트만 작성했고 나머지 둘은 근거와 함께 의도적으로 제외했다(2-3 추적표 §1-3). 슬라이드에 이 사실을 그대로 적어 두었다.' },
  head('오늘 발표, 한 줄 요약', 'RFP가 요구한 3가지, 지금 이렇습니다') +
  fill(`<div style="display:flex; align-items:stretch; gap:20px">` +
    dcard('', '기업 분석 자료', '위탁운영 사업의 실무를 6개 영역으로 분석해 설계의 근거로 삼았습니다.', '현황 분석 파트 작성', '기대효과·유사기업 분석 파트는 근거와 함께 제외했습니다.') +
    `<div style="display:flex; align-items:center"><p style="font-size:56px; font-weight:700; color:${NAVY}">→</p></div>` +
    dcard('', '개발 작업계획서', '시스템 구조와 개발 단계(Phase 0~6)를 한 문서에 담았습니다.', '작성 완료', 'Phase 1~4는 구현, 통합·배포는 진행 중입니다.') +
    `<div style="display:flex; align-items:center"><p style="font-size:56px; font-weight:700; color:${NAVY}">→</p></div>` +
    dcard('', 'ERP 앱', 'RFP의 기능 8개와 신설 1개, 9개 도메인을 구현했습니다.', '9개 도메인 동작', '회원 앱과 실DB 전환은 다음 단계입니다.') +
    `</div>`) +
  `<p style="font-size:32px; font-weight:600; color:${INK}">분석하고, 계획하고, 구현했습니다</p>`);

// ── 문서 화면(브라우저 프레임) ─────────────────────────────────────────────
const frame = (img, alt, url) =>
  `<div style="position:absolute; left:96px; top:212px; width:1000px; display:flex; flex-direction:column; background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; overflow:hidden; box-shadow:${SHADOW}"><div style="display:flex; align-items:center; gap:12px; padding:14px 22px; background:${SURFACE2}; border-bottom:1px solid ${LINE}"><div style="width:16px; height:16px; background:${LINE_STRONG}; border-radius:50%"></div><div style="width:16px; height:16px; background:${LINE_STRONG}; border-radius:50%"></div><div style="width:16px; height:16px; background:${LINE_STRONG}; border-radius:50%"></div><p style="font-family:${MONO}; font-size:24px; color:${SOFT}; padding-left:12px">${url}</p></div><img src="${img}" alt="${alt}" style="width:1000px; height:625px; object-fit:cover"></div>`;
const summaryCol = (blocks) =>
  `<div style="position:absolute; left:1136px; top:212px; width:688px; display:flex; flex-direction:column; gap:30px">${blocks.join('')}</div>`;
const sblock = (l, inner) => `<div style="display:flex; flex-direction:column; gap:10px">${label(l)}${inner}</div>`;
const stext = (t) => `<p style="font-size:30px; line-height:1.45; color:${INK}">${t}</p>`;
const sbullets = (arr) => `<div style="display:flex; flex-direction:column; gap:12px">${arr.map((t) => `<div style="display:flex; align-items:flex-start; gap:14px">${check}<p style="font-size:28px; line-height:1.4; color:${INK}">${t}</p></div>`).join('')}</div>`;

// ── 3 : 기업 분석 자료 ─────────────────────────────────────────────
section('d2-doc', { notes: ' 기업 분석 자료(5-1). 원본 RFP가 시스템 설계에 앞서 "경영시스템·관리시스템 분석"을 선행 과업으로 요구했다. 6개 영역(사업 구조, 위탁계약 라이프사이클, 인력 운용, 예약·결제·정산, 물적자원관리, 문서관리)을 각각 실무 상세 → 분석 결과 → 결론으로 정리했고, 영역 하나만 읽어도 완결된다. 왼쪽은 문서의 실제 화면. 아래 한 줄은 범위 명시: RFP 산출물 2는 3개 파트인데 현황 분석 파트를 작성했고, 기대효과·유사기업 분석은 근거(실제 매출·계약 데이터가 없는 포트폴리오 프로젝트, 벤치마킹 대상 접근 불가)와 함께 제외했다. 분석의 근거는 원본 RFP와 일반적인 실무 관행을 조사해 재구성한 것이며 스포이즘의 내부 자료가 아니다.' },
  head('기업 분석 자료', '기업 분석 자료, 이렇게 만들었습니다') +
  frame(IMG51, '기업 분석 자료 문서 화면 — 개요와 사업 구조 영역', '5-1_기업분석자료.html') +
  summaryCol([
    sblock('무엇인가', stext('위탁운영 사업의 실무를 도메인별로 분석한 문서')),
    sblock('구성', stext('6개 영역 × <b>실무 상세 → 분석 결과 → 결론</b>')),
    sblock('핵심 발견', sbullets(['지점은 매장이 아니라 <b>계약 현장</b>', '직원은 본사가 채용해 <b>파견</b>', '물적자원 관리가 <b>설계의 공백</b>'])),
  ]) +
  foot('RFP상 기업 분석 자료는 3개 파트입니다 — 현황 분석 파트를 작성했고, 기대효과·유사기업 분석 파트는 근거와 함께 제외했습니다.'));

// ── 4 분석 → 설계 → 구현 ───────────────────────────────────────────────────
const td = (t) => `<td style="text-align:left">${t}</td>`;
const tableCard = (inner) => `<div style="background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; padding:20px 32px; box-shadow:${SHADOW}">${inner}</div>`;
const table = (size, colsPct, headers, rows) =>
  `<table style="font-size:${size}px; color:${INK}; font-family:${BODY}"><tr>${headers.map((h, i) => `<th style="width:${colsPct[i]}%; text-align:left; color:${SOFT}">${h}</th>`).join('')}</tr>${rows.map((r) => `<tr style="background:${SURFACE}">${r.join('')}</tr>`).join('')}</table>`;
section('d2-trace', { notes: '이 발표의 핵심 슬라이드(1분 30초). 분석에서 발견한 공백이 설계 결정과 구현으로 이어졌다는 증거다. 제외·미구현 행은 슬라이드에 넣지 않았다. 문장: "분석서에는 실무 전체를 명시하되, 구현을 진행하면서 불필요하다고 판단한 것은 제외하는 방향으로 진행했다." 부가세 행은 백업이며 질문이 나오면 구성안 §5-6으로 답한다.' },
  head('기업 분석 자료', '분석이 설계를 바꾸고, 구현까지 이어졌습니다') +
  fill(tableCard(table(28, [30, 32, 38], ['분석에서 발견한 것', '설계 결정', '구현된 모습'], [
    [td('지점은 매장이 아니라 <b>계약 현장</b>이다'), td('계약 상태를 지점 정보에 추가'), td('계약이 종료된 지점은 신규 회원 등록·예약·게시글 작성이 막힌다')],
    [td('직원은 지점이 아니라 <b>본사가 채용해 파견</b>한다'), td('채용·재배치는 본사 전용, 파견 이력은 기록으로 보존'), td('직원의 파견 이력 화면')],
    [td('물적자원 관리가 <b>설계 전체의 공백</b>이었다'), td('자원문서관리 도메인 신설, 취득가액 100만원 기준 자동 분류'), td('자산·비품, 문서함 화면')],
    [td('동시 예약이 몰리면 <b>정원이 넘칠 수</b> 있다'), td('예약 전에 회차 정원을 확인'), td('정원이 차면 예약을 거절 (DB 전환 시 회차 행 잠금을 추가할 예정)')],
  ]))) + foot('2-3 요구사항 추적표 §2-4'));

// ── 5 : 개발 작업계획서 ────────────────────────────────────────────
section('d3-doc', { notes: ' 개발 작업계획서(5-2), 정식 명칭은 "개발 작업계획서 겸 프로젝트 구조 개요". 왼쪽은 문서의 실제 화면으로, 관리자·회원이 admin-web과 member-app을 거쳐 하나의 REST API(NestJS)를 쓰고, 그 뒤가 데이터 저장소라는 구조가 그려져 있다. 데이터 저장소는 설계 목표가 PostgreSQL(Prisma)이고 현재는 인메모리 mock으로 동작한다. 계획서의 원칙은 날짜로 쪼개기보다 "이 범위가 끝나면 이런 데모가 나온다"는 완성 단계를 정의하는 것이다.' },
  head('개발 작업계획서', '개발 작업계획서, 이렇게 만들었습니다') +
  frame(IMG52, '개발 작업계획서 문서 화면 — 시스템 아키텍처', '5-2_개발작업계획서.html') +
  summaryCol([
    sblock('무엇인가', stext('시스템 구조와 개발 단계를 한 문서에 담은 계획서')),
    sblock('구성', stext('<b>시스템 구조 → 개발 단계(Phase 0~6) → Phase별 상세</b>')),
    sblock('원칙', sbullets(['날짜가 아니라 <b>완성 단계</b>로 정의', 'Phase마다 시연 가능한 데모를 남김', '기능 단위로 묶어 세로로 완성'])),
  ]) +
  foot('저장소 보관본 · docs/5.deliverables/5-2_개발작업계획서.html'));

// ── 6 개발 단계와 현재 위치 ────────────────────────────────────────────────
const ph = (id, name, w, status, kind) => {
  const bg = kind === 'done' ? GREEN_SOFT : AMBER_SOFT, c = kind === 'done' ? GREEN : AMBER;
  return `<div style="flex:${w}; display:flex; flex-direction:column; align-items:flex-start; gap:10px; padding:22px 14px; background:${bg}; border:1px solid ${c}; border-radius:14px"><p style="font-family:${MONO}; font-size:24px; font-weight:700; color:${c}">${id}</p><p style="font-size:28px; font-weight:700; line-height:1.3; color:${INK}">${name}</p><div style="flex:1"></div><p style="font-family:${MONO}; font-size:24px; font-weight:600; color:${c}; background:${SURFACE}; border-radius:999px; padding:2px 12px">${status}</p></div>`;
};
const chipG = (t) => `<p style="font-size:26px; font-weight:600; color:${GRAY}; background:${GRAY_SOFT}; border-radius:999px; padding:8px 24px">${t}</p>`;
section('d3-phases', { notes: '계획서의 개발 단계 타임라인에 현재 위치를 얹은 슬라이드. P1~P4(권한·회원, 인사·근태, 프로그램·예약, 게시판·혼잡도)는 구현했다. P5(통합·배포)는 진행 중이다 — 통합 테스트 일부와 CI가 있고 배포는 아직이다. P6(자원·정산 확장)은 자원문서관리를 구현했고 강사 정산은 제외했다. 회원 앱(React Native)은 P3의 일부인데 아직 시작 전이다. 범위 조정 원칙은 계획서 그대로: 필수 기능은 유지하고 완성도를 높이는 선택 항목부터 제외한다. 제외한 것은 근거와 확장 방향을 2-3 추적표 §2-4에 남겼다.' },
  head('개발 작업계획서', '개발 단계와 현재 위치') +
  `<div style="display:flex; flex-direction:column; gap:36px; flex:1; justify-content:center">` +
  `<div style="display:flex; gap:12px; height:230px">${[ph('P0', '셋업', 0.8, '완료', 'done'), ph('P1', '권한·회원', 1.5, '구현', 'done'), ph('P2', '인사·근태', 1, '구현', 'done'), ph('P3', '프로그램·예약', 1.5, '구현', 'done'), ph('P4', '게시판·<br>혼잡도', 1, '구현', 'done'), ph('P5', '통합·배포', 1.25, '진행 중', 'part'), ph('P6', '자원·정산 확장', 1.5, '일부', 'part')].join('')}</div>` +
  card(`<p style="font-family:${MONO}; font-size:24px; font-weight:600; letter-spacing:2px; color:${NAVY}">범위 조정 원칙</p><p style="font-size:32px; font-weight:600; line-height:1.4; color:${INK}">필수 기능은 유지하고, 완성도를 높이는 선택 항목부터 제외했습니다.</p><div style="display:flex; gap:14px; flex-wrap:wrap">${chipG('강사 정산·원천징수')}${chipG('혼잡도 QR 체크인·자동 계산')}${chipG('노쇼·결근 자동 처리')}${chipG('감가상각')}</div>`) +
  `</div>` +
  foot('P3의 회원 앱과 P5의 배포는 아직 남았습니다 · 제외 항목의 근거는 2-3 요구사항 추적표 §2-4'));

// ── 7 : 도메인 지도 ────────────────────────────────────────────────
const doms = [
  ['권한관리', '4개 역할 · 지점 간 데이터 격리', false], ['인사정보관리', '본사 채용 · 지점 파견 · 이력', false], ['근태관리', '체크인 · 지각 판정 · 휴가·연차', false],
  ['게시판·공지사항', '본사 공지 · 지점 공지', false], ['회원관리', '등록 · 상태 관리 · 보호자 동의', false], ['예약·결제', '회차 예약 · 모의 결제 · 환불', false],
  ['강사·프로그램', '강사 · 프로그램 · 상태 전이 · 회차', false], ['혼잡도관리', '5단계 산출 · 수동 보정', false], ['자원문서관리', '자산 분류·상태 · 문서 보존기한', true],
];
const dcell = ([n, d, isNew]) => `<div style="display:flex; flex-direction:column; gap:10px; background:${isNew ? NAVY_SOFT : SURFACE}; border:1px solid ${isNew ? NAVY : LINE}; border-radius:14px; padding:26px 30px; box-shadow:${SHADOW}"><div style="display:flex; align-items:center; justify-content:space-between; gap:12px"><h3 style="font-family:${DISPLAY}; font-size:40px; font-weight:700; color:${INK}">${n}</h3>${pill(isNew ? '신설' : '구현됨', isNew ? NAVY : GREEN_SOFT, isNew ? '#FFFFFF' : GREEN)}</div><p style="font-size:28px; line-height:1.4; color:${SOFT}">${d}</p></div>`;
section('domains', { notes: ' ERP 앱은 RFP의 기능 8개(권한관리, 인사정보관리, 근태관리, 게시판, 회원관리, 예약및결제, 강사·프로그램게시, 혼잡도관리)와 기업 분석에서 도출해 신설한 자원문서관리, 모두 9개 도메인이다. 다음 9장은 같은 템플릿으로 도메인마다 왼쪽에 RFP 요구·우리의 해석·동작하는 기능, 오른쪽에 핵심 도식을 보여준다. 규모 변화는 2주차 종료(9/10, 5fc04bc) 대비 코드에서 재실측한 값이다.' },
  head('ERP 앱', '9개 도메인, 모두 화면에서 동작합니다') +
  fill(`<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:24px">${doms.map(dcell).join('')}</div>`) +
  foot('2주차 종료(9/10) 대비 — API 엔드포인트 23 → 68 · 관리자 웹 페이지 9 → 16 · 데이터 엔티티 8 → 19'));

// ── 8~16 도메인 슬라이드(같은 템플릿) ───────────────────────────────────────
const domData = [
  { id: 'dom-auth', name: '권한관리', pill: '구현됨', fig: D.dAuth, rfp: '관리자 계정에만 권한 부여 · 본사·현장·이용자 권한 분리 · 퇴사 후 접근 통제', view: '세부 권한 대신 <b>4개 역할</b>로 고정하고, 지점 간 데이터는 항상 격리한다', feats: ['역할별 화면·API 접근 제어', '다른 지점 데이터 접근 차단', '퇴사·탈퇴 즉시 접근 차단', '본사의 직원 역할 전환'], src: '1-2 권한관리', notes: '권한관리: 4개 역할과 3관문. 요청은 로그인 → 역할 → 지점의 세 관문을 통과해야 데이터에 닿고, 다른 지점의 데이터는 마지막 관문에서 막힌다. 지점 격리는 가드와 컨트롤러가 이중으로 검사한다. 질문이 나오면(구성안 §5-5): 자동 테스트로 확인했고 그 과정에서 검사가 빠져 있던 라우트 1건을 찾아 수정했다. [사이드바 역할별 비교 캡처 자리 — 본사 vs 지점 관리자 vs 회원]' },
  { id: 'dom-hr', name: '인사정보관리', pill: '구현됨', fig: D.dHr, rfp: '현장별 인사 관리 · 모든 인사 기록을 한 화면에서 · 권한 부여·승인 시 수정', view: '직원은 지점이 채용하는 게 아니라 <b>본사가 채용해 파견</b>한다', feats: ['채용·재배치는 본사 전용 (API)', '파견 이력을 기록으로 보존', '지점 관리자는 소속 직원 관리', '직원 본인 정보 조회'], src: '1-3 인사정보관리', notes: '인사정보관리: 본사가 채용하고 지점에 파견한다. 재배치도 본사만 할 수 있고 이전 파견은 기록으로 남는다. 지점 관리자는 현재 파견된 직원의 일상 관리(정보 수정, 퇴사 처리)만 한다. 이 구조는 기업 분석에서 발견한 것이다. [시연 스크린샷 자리]' },
  { id: 'dom-attend', name: '근태관리', pill: '구현됨', fig: D.dAttend, rfp: '현장별·개인별 근태 · 휴무·연차·병가 일수 관리 · 업무일지', view: '수동 체크인에 <b>지각을 자동 판정</b>하고, 연차만 잔여일수를 차감한다', feats: ['출근·퇴근 체크', '지각 자동 판정(기준시각 +10분)', '휴가 신청·승인·반려', '연차 잔여일수 · 업무일지'], src: '1-4 근태관리', notes: '근태관리: 체크인은 지점 기준시각 +10분을 넘기면 지각이다. 휴가는 신청 → 지점 관리자 승인이고, 연차만 잔여일수에서 차감한다. 병가·경조는 승인돼도 차감하지 않는다. 시연: 체크인 → 휴가 신청 → 승인 → 잔여연차 감소. 주의: 조퇴·결근·휴가 상태는 자동 판정이 없으므로 "근태 상태 5종"이라고 말하지 말 것. [시연 스크린샷 자리]' },
  { id: 'dom-board', name: '게시판·공지사항', pill: '구현됨', fig: D.dBoard, rfp: '본사→현장, 현장→이용자 게시판 분리 · 직원 교육자료', view: '공지를 <b>본사 공지와 지점 공지</b>로 나눠 열람 범위를 다르게 한다', feats: ['공지 작성·수정·삭제', '전체 또는 지정 지점 대상', '자기 지점 글만 열람', '수정은 작성자 본인만'], src: '1-5 게시판·공지사항', notes: '게시판: 본사 공지는 전체 또는 지정한 지점에, 지점 공지는 자기 지점의 회원·직원에게 간다. 지점 사용자는 전체 공지와 자기 지점의 글만 볼 수 있다. 시연: 본사·지점 공지 작성, 작성자 본인만 수정. [시연 스크린샷 자리]' },
  { id: 'dom-member', name: '회원관리', pill: '구현됨', fig: D.dMember, rfp: '지점별 회원 인적사항 · 수강·결제 내역 · 타 현장 조회 불가', view: '회원은 항상 <b>한 지점에 속하고</b>, 그 지점 관리자만 다룬다', feats: ['회원 등록·수정', '상태 관리(활성·휴면·탈퇴)', '미성년 보호자 동의 확인', '담당 직원 배정'], src: '1-6 회원관리', notes: '회원관리: 지점 관리자가 자기 지점에 회원을 등록하고, 미성년이면 보호자 동의를 확인한다. 다른 지점의 회원은 조회·수정할 수 없다(원본 RFP의 핵심 요구). 시연: 회원 등록(보호자 동의 체크) → 상세. 수강내역·PT 잔여세션은 아직 없다. [시연 스크린샷 자리]' },
  { id: 'dom-reserve', name: '예약·결제', pill: '구현됨 · Phase 1+2', fig: D.dReserve, rfp: '무료·유료 프로그램 게시 후 예약 · 모바일 결제', view: '실제 PG 대신 <b>모의 결제</b>를 쓰고, 상태 전이는 실물처럼 구현했다', feats: ['회차 예약 · 정원·중복 확인', '모의 결제 승인 후 확정', '24시간 기준 환불·취소', '체크인 처리'], src: '1-7 예약및결제 §6', notes: '예약·결제: 예약 흐름과 24시간 환불 기준(지점별 설정, 기본 24시간). 예약할 때 진행중·정원·중복을 확인한다. 동시성은 구두로: 문서는 DB 행 락을 설계했고, 지금은 동기 실행 mock이라 별도 락 없이 안전하며 DB 전환 시 락을 복원한다. 시연: 회원 예약 → 결제 대기 → 모의결제 → 확정 → 취소(자동 환불). 회원 앱이 미착수라 회원 화면은 회원 계정으로 로그인한 관리자 웹 화면이다. [시연 스크린샷 자리 — 단계별 캡처]' },
  { id: 'dom-program', name: '강사·프로그램', pill: '구현됨', fig: D.dProgram, rfp: '종목별 강사·프로그램 게시 · 종목·시간대·연령대별 목록', view: '프로그램에 <b>상태</b>를 두어 운영 흐름을 관리한다', feats: ['강사 등록·수정·비활성', '프로그램 등록·수정·종료', '허용된 상태 전이만 통과', '회차 등록 · 연령대·요금 유형'], src: '1-8 강사프로그램게시 §3-2', notes: '강사·프로그램: 프로그램 상태는 준비중 → 진행중 ⇄ 휴강 → 종료로만 바뀌고, 준비중과 휴강에서도 바로 종료할 수 있다. 종료는 되돌릴 수 없다. 예약은 진행중일 때만 가능하다. 시연: 프로그램 등록(자유이용 선택 시 가격·정원 비활성) → 상태 전이. [시연 스크린샷 자리]' },
  { id: 'dom-congest', name: '혼잡도관리', pill: '구현됨', fig: D.dCongest, rfp: '시설별 이용 현황·혼잡도 5단계 게시 · 실시간~30분 이내 반영', view: '계측 장비가 없어 <b>관리자가 인원을 보정</b>하면 5단계가 즉시 갱신된다', feats: ['시설 등록·수정', '현재 인원 수동 보정', '5단계 자동 산출', '시설별 혼잡도 카드'], src: '1-9 혼잡도관리 §4', notes: '혼잡도관리: 현재 인원 ÷ 정원의 비율로 5단계(여유·보통·약간 붐빔·붐빔·매우 붐빔)가 정해진다. 계측 장비가 없어 관리자가 인원을 직접 보정하면 단계가 즉시 재계산된다. QR 체크인·5분 자동계산은 앱과 스케줄러가 없어 제외했다. 시연: 보정 전후 카드. [시연 스크린샷 자리]' },
  { id: 'dom-asset', name: '자원문서관리', pill: '신설 · 구현됨', fig: D.dAsset, rfp: 'RFP 기능 8개에는 없음 — 기업 분석(과업1)의 "물적자원 관리 현황"에서 도출', view: '자산·비품과 법적 증빙 문서를 <b>별도 도메인으로 신설</b>했다', feats: ['자산 등록·수정·상태 관리', '취득가액 100만원 기준 자동 분류', '문서 등록·조회·삭제', '보존기한 자동 계산·임박 표시'], src: '1-10 자원문서관리 §4·§5', notes: '자원문서관리: 기업 분석에서 물적자원 관리가 설계에 통째로 빠져 있음을 발견해 신설한 도메인이다. 자산은 취득가액 100만원 초과면 고정자산, 이하면 소모품으로 자동 분류된다. 문서는 인사서류 퇴사 후 3년(자동), 계약서 직접 입력, 매뉴얼·기타 영구다. 재물조사와 감가상각은 이번 범위에서 제외했다. 시연: 자산 등록 시 자동 분류 → 상태 전환 / 문서 등록 → 보존기한 임박 배지. [시연 스크린샷 자리]' },
];

// ── 도메인별 구현 화면 슬라이드 ─────────────────────────────────────────────
const B = (id) => '/_blob/' + id;
const SHOTS = {
  'dom-auth': [{ img: B('0791efdf372958229f1331a9037557f1'), w: 1600, h: 900, url: '/permissions · 본사 관리자', pts: ['본사 관리자(정하늘)로 로그인한 화면', '직원별 권한을 <b>지점 직원 ↔ 지점 관리자</b>로 전환', '본사 전용 메뉴 <b>인사·권한</b>이 따로 보임'] }],
  'dom-hr': [{ img: B('0d68ad0e6c850080787532d5076b0875'), w: 1600, h: 900, url: '/branches/서초점 · 본사 관리자', pts: ['지점은 <b>위탁계약 현장</b> — 계약 상대방·기간·상태·잔여일', '현장에 <b>파견된 직원</b>과 담당 회원 수', '채용·재배치는 <b>API로 구현</b>, 화면은 후속 과제'] }],
  'dom-attend': [{ img: B('193cc416929183fb665656b7a91e4225'), w: 1600, h: 900, url: '/attendance · 지점 관리자', pts: ['지점 관리자(김민수)가 보는 근태 화면', '출근·퇴근 체크와 <b>지각 자동 판정</b>', '휴가 신청·승인, 연차 잔여일수, 업무일지'] }],
  'dom-board': [{ img: B('1a0971d03d90972ccb6bd23707b935e3'), w: 1600, h: 480, url: '/board · 지점 관리자', pts: ['본사 공지와 지점 공지를 한 목록에서 구분', '자기 지점 대상의 글만 열람', '작성자 본인만 수정·삭제'] }],
  'dom-member': [{ img: B('774c549ee1281dfd2d09bc1d86dc8ffe'), w: 1600, h: 900, url: '/members · 지점 관리자', pts: ['<b>자기 지점 회원</b>만 조회·등록·수정', '상태(활성·휴면·탈퇴)와 담당 직원 표시', '미성년 회원은 보호자 동의 확인'] }],
  'dom-reserve': [
    { img: B('d3d547613b160467356ee510d4a3d3e9'), w: 1600, h: 530, url: '/reservations · 회원 · ① 예약 직후', pts: ['회원이 회차를 골라 <b>예약하기</b>', '상태는 <b>결제 대기</b>, 결제금액 30,000원', '이 화면은 회원 계정으로 로그인한 관리자 웹 (회원 앱은 미착수)'] },
    { img: B('7ec6ad4a577ca30f2de9cd69a46ac15d'), w: 1600, h: 530, url: '/reservations · 회원 · ② 모의 결제 후', pts: ['<b>모의 결제</b> 승인 후 상태가 <b>확정</b>으로 바뀜', '확정된 예약은 취소 가능 — 24시간 기준으로 환불 판정', '실제 PG는 연동하지 않고 상태 전이만 구현'] },
  ],
  'dom-program': [{ img: B('a3d104aead952097449fe5aef0b73461'), w: 1600, h: 508, url: '/programs · 지점 관리자', pts: ['프로그램 목록과 <b>상태</b>(준비중·진행중·휴강·종료)', '종목·요금 유형·강사·연령대 표시', '허용된 상태 전이만 통과'] }],
  'dom-congest': [{ img: B('989fb1d707e21879d7a221af925f6bf9'), w: 1600, h: 490, url: '/facilities · 지점 관리자', pts: ['시설별 <b>혼잡도 5단계</b> 카드', '현재 인원을 관리자가 <b>수동 보정</b>하면 즉시 갱신', '시설 등록·수정'] }],
  'dom-asset': [
    { img: B('cc62c2e1c1e09d41c864f1aaa4d18d16'), w: 1600, h: 480, url: '/assets · 지점 관리자', pts: ['자산·비품 목록과 상태 관리', '취득가액 100만원 기준 <b>고정자산·소모품 자동 분류</b>', '등록·수정·상태 전환'] },
    { img: B('8cf4a9b8bd9c053407acd33f1ba7255d'), w: 1600, h: 480, url: '/documents · 지점 관리자', pts: ['문서함: 인사서류·계약서·매뉴얼 등 분류', '<b>보존기한 자동 계산</b>과 임박 표시', '등록·조회·삭제'] },
  ],
};
function shotSlide(d, i, sh, k, total) {
  const wide = sh.h < 700;
  const FW = wide ? 1380 : 1120;
  const LX = wide ? 270 : 96;
  const IH = Math.round((FW * sh.h) / sh.w);
  const bar = `<div style="display:flex; align-items:center; gap:12px; padding:14px 22px; background:${SURFACE2}; border-bottom:1px solid ${LINE}"><div style="width:16px; height:16px; background:${LINE_STRONG}; border-radius:50%"></div><div style="width:16px; height:16px; background:${LINE_STRONG}; border-radius:50%"></div><div style="width:16px; height:16px; background:${LINE_STRONG}; border-radius:50%"></div><p style="font-family:${MONO}; font-size:24px; color:${SOFT}; padding-left:12px">${sh.url}</p></div>`;
  const fr = `<div style="position:absolute; left:${LX}px; top:212px; width:${FW}px; display:flex; flex-direction:column; background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; overflow:hidden; box-shadow:${SHADOW}">${bar}<img src="${sh.img}" alt="${esc(d.name)} 구현 화면" style="width:${FW}px; height:${IH}px"></div>`;
  let cap;
  if (wide) {
    const top = 212 + 112 + IH + 28;
    cap = `<div style="position:absolute; left:270px; top:${top}px; width:1380px; display:flex; gap:20px">${sh.pts.map((t) => `<div style="flex:1; display:flex; align-items:flex-start; gap:14px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; padding:16px 20px">${check}<p style="font-size:28px; line-height:1.4; color:${INK}">${t}</p></div>`).join('')}</div>`;
  } else {
    cap = `<div style="position:absolute; left:${96 + FW + 40}px; top:212px; width:${1728 - FW - 40}px; display:flex; flex-direction:column; gap:26px">${label('이렇게 구현했습니다')}${sbullets(sh.pts)}</div>`;
  }
  const sub = total > 1 ? ` (${k + 1}/${total})` : '';
  const note = `${d.name} 구현 화면${sub}. 실제 admin-web 캡처(로컬 개발 서버, mock 데이터). ` + (d.id === 'dom-reserve' ? '회원 앱이 미착수라 회원 화면은 회원 계정으로 로그인한 관리자 웹 화면이다. ' : '') + (d.id === 'dom-hr' ? '채용·재배치는 API와 통합 테스트로 검증했고 화면은 없다(후속 과제). 지점 상세 화면은 본사 관리자 시점이다. ' : '');
  section(`${d.id}-shot${total > 1 ? k + 1 : ''}`, { notes: note }, head(`도메인 ${i + 1} / 9 · 구현 화면`, d.name) + fr + cap + foot('실제 관리자 웹 화면 · 로컬 개발 서버 · mock 데이터'));
}
domData.forEach((d, i) => {
  lib.setSlide({ left: 800, top: 234, scale: 1 });
  const frag = d.fig();
  const left = `<div style="position:absolute; left:96px; top:212px; width:640px; display:flex; flex-direction:column; gap:32px">` +
    `<div style="display:flex; flex-direction:column; gap:10px">${label('RFP 요구')}<p style="font-size:28px; line-height:1.45; color:${SOFT}">${d.rfp}</p></div>` +
    `<div style="display:flex; flex-direction:column; gap:10px">${label('우리의 해석')}<p style="font-size:30px; line-height:1.45; color:${INK}">${d.view}</p></div>` +
    `<div style="display:flex; flex-direction:column; gap:10px">${label('동작하는 기능')}${sbullets(d.feats)}</div></div>`;
  const cardBox = `<div style="position:absolute; left:776px; top:212px; width:1048px; height:748px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; box-shadow:${SHADOW}"></div>`;
  const status = `<div style="position:absolute; right:96px; top:84px; display:flex">${pill(d.pill, d.pill.startsWith('신설') ? NAVY : GREEN_SOFT, d.pill.startsWith('신설') ? '#FFFFFF' : GREEN)}</div>`;
  section(d.id, { notes: d.notes }, head(`도메인 ${i + 1} / 9`, d.name) + status + left + cardBox + frag + foot(d.src));
  (SHOTS[d.id] || []).forEach((sh, k, arr) => shotSlide(d, i, sh, k, arr.length));
});

// ── 17 남은 일과 다음 계획 ────────────────────────────────────────────────
const icon = (kind) => `<div style="width:28px; height:28px; background:${kind === 'gray' ? GRAY : '#C77B18'}; border-radius:7px"></div>`;
const tl = (h, d, last) =>
  `<div style="display:flex; gap:28px"><div style="width:28px; display:flex; flex-direction:column; align-items:center"><div style="width:26px; height:26px; background:${NAVY}; border-radius:50%; margin-top:12px"></div>${last ? '' : `<div style="flex:1; width:3px; background:${LINE_STRONG}; margin-top:8px"></div>`}</div><div style="display:flex; flex-direction:column; gap:4px; padding-bottom:${last ? 0 : 26}px"><h3 style="font-family:${DISPLAY}; font-size:40px; font-weight:700; color:${INK}">${h}</h3><p style="font-size:28px; line-height:1.4; color:${SOFT}">${d}</p></div></div>`;
const left = (items) => items.map(([a, b]) => `<div style="display:flex; flex-direction:column; gap:4px; padding:16px 0; border-top:1px solid ${LINE}"><p style="font-size:30px; font-weight:700; line-height:1.3; color:${INK}">${a}</p><p style="font-size:26px; line-height:1.35; color:${SOFT}">${b}</p></div>`).join('');
section('next', { notes: '남은 일은 숨기지 않는다. 왼쪽은 RFP가 요구하는데 아직 없는 것과 설계에는 있으나 구현 전인 것. 오른쪽은 다음 계획 후보로, 우선순위는 회원 앱 착수 여부와 실DB 전환 시점에 따라 달라진다. 실DB 전환 때 지점 격리 검사의 공통화도 함께 한다.' },
  head('마무리', '남은 일과 다음 계획') +
  `<div style="flex:1; display:flex; gap:32px; align-items:flex-start">` +
  `<div style="flex:1; display:flex; flex-direction:column; background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; padding:36px; box-shadow:${SHADOW}"><div style="display:flex; align-items:center; gap:16px; padding-bottom:12px">${icon('amber')}<h3 style="font-family:${DISPLAY}; font-size:44px; font-weight:700; color:${INK}">남긴 것</h3></div>${left([['회원 PT 잔여세션 · 수강내역', 'RFP 요구, 아직 없음'], ['인사 변경 신청 승인', 'RFP 요구, 아직 없음'], ['변경 이력 기록 · 응답 마스킹', 'RFP 요구, 아직 없음'], ['게시판 교육자료 첨부', 'RFP 요구, 아직 없음'], ['계약 종료 시 파견 직원·소속 계정 정리', '설계에는 있으나 구현 전']])}</div>` +
  `<div style="flex:1; display:flex; flex-direction:column; background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; padding:36px; box-shadow:${SHADOW}"><div style="padding-bottom:20px"><h3 style="font-family:${DISPLAY}; font-size:44px; font-weight:700; color:${INK}">다음 계획 후보</h3></div>${tl('회원 앱 착수', 'React Native(Expo)로 이용자용 앱을 시작합니다.')}${tl('"남긴 것" 처리', 'RFP 잔여 항목을 채웁니다.')}${tl('실DB 전환', 'Prisma/PostgreSQL 연동, 지점 격리 검사의 공통화도 함께 합니다.')}${tl('계약서 OCR·AI', '2주차부터 이어진 설계를 실제 흐름으로 구현합니다.', true)}</div>` +
  `</div>`);

// ── 18 마무리 ─────────────────────────────────────────────────────────────
section('closing', { pad: '128px 176px', gap: 24, notes: '질문과 토론. 예상 질문 대비는 구성안 §5를 참고: 분석 근거의 범위, 검증·테스트 현황, 부가세 처리 등.' },
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
  createdOnFiles: { v: 1, at: '2026-09-20T23:21:21Z' },
  title: '3주차 진행상황 발표',
  order,
  sections: {
    intro: { description: 'RFP가 요구한 3가지의 현황', start: 'cover' },
    analysis: { description: ' — 실무를 분석해 설계의 근거로 삼은 기업 분석 자료', start: 'd2-doc' },
    plan: { description: ' — 시스템 구조와 개발 단계를 담은 개발 작업계획서', start: 'd3-doc' },
    app: { description: ' — 9개 도메인으로 구현한 ERP 앱', start: 'domains' },
    wrap: { description: '남은 일과 다음 계획', start: 'next' },
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
