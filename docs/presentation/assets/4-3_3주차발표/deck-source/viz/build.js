const fs = require('fs');
const path = require('path');
const lib = require('./lib');
const A = require('./figs-a');
const B = require('./figs-b');
const C = require('./figs-c');

const FIGS = [
  ['slide-04-analysis-structure', A.f04], ['slide-05-business-map', A.f05], ['slide-07-domain-hub', A.f07],
  ['slide-09-guard-path', B.f09], ['slide-10-hr-attendance', B.f10], ['slide-11-member-program', B.f11],
  ['slide-12-reservation', B.f12], ['slide-14-board-congestion', C.f14], ['slide-15-asset-document', C.f15],
];

// 1) 페이지용(CSS 변수) SVG
lib.setMode('page');
const page = {};
FIGS.forEach(([slug, fn]) => { page[slug] = fn(); });

// 2) PowerPoint용 독립 SVG(고정 색)
lib.setMode('file');
const outDir = path.join(__dirname, 'svg');
fs.mkdirSync(outDir, { recursive: true });
FIGS.forEach(([slug, fn]) => {
  fs.writeFileSync(path.join(outDir, slug + '.svg'), '<?xml version="1.0" encoding="UTF-8"?>\n' + fn(), 'utf8');
});
lib.setMode('page');

const pill = (k, t) => `<span class="pill ${k}">${t}</span>`;
const fig = (slug, cap) => `<figure class="fig"><div class="scroll">${page[slug]}</div><figcaption>${cap}</figcaption></figure>`;
const sec = (id, n, title, body, src) => `
<section id="${id}">
  <p class="eyebrow">슬라이드 ${n}</p>
  <h2>${title}</h2>
  ${body}
  ${src ? `<p class="src">출처 · ${src}</p>` : ''}
</section>`;

// 슬라이드 6: 추적표(발표용 6행)
const trace = [
  ['지점은 매장이 아니라 <b>계약 현장</b>이다', '계약 상태를 지점 정보에 추가', '계약이 종료된 지점은 신규 회원 등록·예약·게시글 작성이 막힌다'],
  ['직원은 지점이 아니라 <b>본사가 채용해 파견</b>한다', '채용·재배치는 본사 전용, 파견 이력은 기록으로 보존', '직원의 파견 이력 화면'],
  ['물적자원 관리가 <b>설계 전체의 공백</b>이었다', '자원문서관리 도메인 신설, 취득가액 100만원 기준 자동 분류', '자산·비품, 문서함 화면'],
  ['동시 예약이 몰리면 <b>정원이 넘칠 수</b> 있다', '예약 전에 회차 정원을 확인', '정원이 차면 예약을 거절 (DB 전환 시 회차 행 잠금을 추가할 예정)'],
];
const t6 = `<figure class="fig"><div class="scroll"><table class="tbl trace">
<thead><tr><th>실무에서 발견한 것</th><th>설계 결정</th><th>구현된 모습</th></tr></thead>
<tbody>${trace.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`).join('')}</tbody></table></div>
<figcaption>분석에서 발견한 공백이 설계 결정과 구현으로 이어졌다.</figcaption></figure>`;

// 슬라이드 8: 넣은 것 / 뺀 것 / 남긴 것
const col3 = [
  ['넣은 것', 'in', [
    ['자원문서관리', '실무 분석에서 물적자원이 설계에서 통째로 빠져 있음을 발견'],
    ['프로그램 회차', '예약이 성립하려면 꼭 필요한 단위'],
  ]],
  ['뺀 것', 'out', [
    ['강사 정산 · 원천징수', 'RFP가 요구하지 않음'],
    ['혼잡도 QR 체크인 · 자동 계산', '수동 보정으로 요건을 충족'],
    ['노쇼·결근 자동 처리', '자동 실행 장치(스케줄러)가 없음'],
    ['감가상각', '회계 모듈이 없어 받을 곳이 없음'],
  ]],
  ['남긴 것', 'gap', [
    ['회원 PT 잔여세션 · 수강내역', 'RFP 요구, 아직 없음'],
    ['인사 변경 신청 승인', 'RFP 요구, 아직 없음'],
    ['변경 이력 기록 · 응답 마스킹', 'RFP 요구, 아직 없음'],
    ['게시판 교육자료 첨부', 'RFP 요구, 아직 없음'],
    ['계약 종료 시 파견 직원·소속 계정 정리', '설계에는 있으나 구현 전'],
  ]],
];
const t8 = `<figure class="fig"><div class="cols3">${col3.map(([h, k, items]) => `<div class="col ${k}"><h3>${h}</h3><ul>${items.map(([a, b]) => `<li><b>${a}</b><span>${b}</span></li>`).join('')}</ul></div>`).join('')}</div>
<figcaption>분석은 끝까지 했고 구현은 판단해서 잘랐다. 안 만든 것에도 이유를 남겼고, RFP 요구인데 아직 없는 것은 숨기지 않는다.</figcaption></figure>`;

// 슬라이드 9: 4-Role × 접근 범위
const M = { all: '전체', br: '자기 지점', me: '본인만', no: '접근 불가', rd: '열람' };
const matrix = [
  ['회원 정보', ['all', '전체 조회·수정'], ['br', '등록·수정'], ['no', ''], ['me', '본인 정보']],
  ['직원 · 인사', ['all', '채용·재배치'], ['br', '자기 지점 직원 관리'], ['me', '본인 정보'], ['no', '']],
  ['예약 · 결제', ['all', '전체 조회'], ['br', '체크인·취소'], ['no', ''], ['me', '예약·결제']],
  ['게시판', ['all', '본사 공지 작성'], ['br', '지점 공지 작성'], ['rd', '열람'], ['rd', '열람']],
  ['자산 · 문서', ['all', '전체'], ['br', '자기 지점'], ['no', ''], ['no', '']],
];
const cell = ([k, t]) => `<td class="m ${k}"><span class="tag">${M[k]}</span>${t ? `<span class="sub">${t}</span>` : ''}</td>`;
const t9 = `<figure class="fig"><div class="scroll"><table class="tbl matrix">
<thead><tr><th></th><th>본사 관리자</th><th>지점 관리자</th><th>직원</th><th>회원</th></tr></thead>
<tbody>${matrix.map(([d, ...cs]) => `<tr><th scope="row">${d}</th>${cs.map(cell).join('')}</tr>`).join('')}</tbody></table></div>
<figcaption>역할마다 접근 범위가 다르다. 지점 관리자·직원·회원의 "자기 지점"과 "본인만"은 코드가 강제한다.</figcaption></figure>`;

const nav = [
  ['s4', '4 분석서 구조'], ['s5', '5 실무 지도'], ['s6', '6 추적표'], ['s7', '7 확장 지도'], ['s8', '8 판단 사례'],
  ['s9', '9 권한·격리'], ['s10', '10 인사·근태'], ['s11', '11 회원·프로그램'], ['s12', '12 예약·결제'], ['s14', '14 게시판·혼잡도'], ['s15', '15 자원문서'],
];

const CSS = `
:root{--ink:#17212B;--muted:#566771;--line:#C5D1CE;--paper:#F4F7F6;--surface:#FFFFFF;--green:#17714F;--greenBg:#E2F2EB;--blue:#2456C8;--blueBg:#E4ECFB;--amber:#8F5407;--amberBg:#FBEFD9;--red:#B4302A;--redBg:#FBE6E4;--gray:#5F6C74;--grayBg:#ECF0EF;--lv1:#2E9E6B;--lv2:#7DB33F;--lv3:#D6B41F;--lv4:#E48A1E;--lv5:#C93B2F;--sans:'IBM Plex Sans KR','Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif;--mono:'IBM Plex Mono',Consolas,'Courier New',monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--ink:#E6EDF0;--muted:#9DABB3;--line:#34454C;--paper:#0F171B;--surface:#162127;--green:#4CC79A;--greenBg:#153A2E;--blue:#86AAFF;--blueBg:#18294F;--amber:#F0B45A;--amberBg:#3D2C10;--red:#FF8B82;--redBg:#43201E;--gray:#9AA7AF;--grayBg:#1F2D33;--lv1:#3DB37D;--lv2:#8FC24F;--lv3:#DDBA2D;--lv4:#EE9A32;--lv5:#E2564A}}
:root[data-theme="dark"]{--ink:#E6EDF0;--muted:#9DABB3;--line:#34454C;--paper:#0F171B;--surface:#162127;--green:#4CC79A;--greenBg:#153A2E;--blue:#86AAFF;--blueBg:#18294F;--amber:#F0B45A;--amberBg:#3D2C10;--red:#FF8B82;--redBg:#43201E;--gray:#9AA7AF;--grayBg:#1F2D33;--lv1:#3DB37D;--lv2:#8FC24F;--lv3:#DDBA2D;--lv4:#EE9A32;--lv5:#E2564A}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.6;padding-inline:20px}
.wrap{max-width:1240px;margin:0 auto;padding-block:36px 72px}
header h1{font-size:clamp(26px,4vw,38px);line-height:1.2;margin:0 0 10px;letter-spacing:-.01em;text-wrap:balance}
header p{margin:0;max-width:68ch;color:var(--muted)}
.legend{display:flex;flex-wrap:wrap;gap:10px 18px;margin-top:18px;font-size:13px;color:var(--muted);align-items:center}
nav.toc{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0 8px}
nav.toc a{font-size:13px;color:var(--ink);text-decoration:none;border:1px solid var(--line);background:var(--surface);padding:5px 11px;border-radius:999px}
nav.toc a:hover{border-color:var(--green);color:var(--green)}
nav.toc a:focus-visible{outline:2px solid var(--blue);outline-offset:2px}
section{padding-top:44px}
.eyebrow{margin:0;font-family:var(--mono);font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--green)}
section h2{font-size:24px;line-height:1.3;margin:4px 0 14px;text-wrap:balance}
figure.fig{margin:0 0 16px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px 14px 12px}
.scroll{overflow-x:auto}
.scroll svg{display:block;width:100%;height:auto;min-width:820px}
figcaption{margin-top:10px;font-size:14px;color:var(--muted);max-width:90ch}
.src{margin:0;font-family:var(--mono);font-size:12px;color:var(--muted)}
code{font-family:var(--mono);font-size:.88em}
.pill{display:inline-block;font-size:12.5px;font-weight:600;padding:2px 10px;border-radius:999px;border:1px solid}
.pill.ok{color:var(--green);background:var(--greenBg);border-color:var(--green)}
.pill.plan{color:var(--amber);background:var(--amberBg);border-color:var(--amber)}
.pill.skip{color:var(--gray);background:var(--grayBg);border-color:var(--gray)}
.pill.no{color:var(--red);background:var(--redBg);border-color:var(--red)}
table.tbl{border-collapse:collapse;width:100%;min-width:820px;font-size:14.5px}
.tbl th,.tbl td{border-bottom:1px solid var(--line);padding:11px 12px;text-align:left;vertical-align:top}
.tbl thead th{font-size:13px;color:var(--muted);font-weight:600;border-bottom:2px solid var(--ink)}
.tbl td b{font-weight:700}
.trace td:nth-child(3){white-space:normal}
.note{display:block;margin-top:5px;font-size:13px;color:var(--muted)}
.matrix thead th code{display:block;font-size:11.5px;color:var(--muted);font-weight:500}
.matrix tbody th{font-size:14px;white-space:nowrap}
.matrix td.m{padding:9px 12px}
.matrix .tag{display:block;font-size:12px;font-weight:700;letter-spacing:.02em}
.matrix .sub{display:block;font-size:13px;margin-top:1px}
.m.all{background:var(--greenBg);color:var(--green)}.m.all .sub{color:var(--ink)}
.m.br{background:var(--blueBg);color:var(--blue)}.m.br .sub{color:var(--ink)}
.m.me{background:var(--amberBg);color:var(--amber)}.m.me .sub{color:var(--ink)}
.m.rd{background:var(--grayBg);color:var(--gray)}.m.rd .sub{color:var(--ink)}
.m.no{color:var(--muted)}
.cols3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.col{border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:var(--surface)}
.col h3{margin:0 0 10px;font-size:16px}
.col ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.col li b{display:block;font-size:14.5px}
.col li span{display:block;font-size:13.5px;color:var(--muted)}
.col.in{border-color:var(--green);background:var(--greenBg)}.col.in h3{color:var(--green)}
.col.out{border-color:var(--gray);background:var(--grayBg)}.col.out h3{color:var(--gray)}
.col.gap{border-color:var(--amber);background:var(--amberBg)}.col.gap h3{color:var(--amber)}
@media (max-width:900px){.cols3{grid-template-columns:1fr}}
@media (prefers-reduced-motion:no-preference){nav.toc a{transition:border-color .15s,color .15s}}
`;

const html = `<title>3주차 발표 시각화</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
<div class="wrap">
<header>
  <h1>3주차 발표 시각화</h1>
  <p>4-3 구성안의 시각화입니다. 슬라이드 본문 영역 비율(1200×560)로 맞췄습니다. 동작하는 것만 그렸고, 아직 구현되지 않은 항목은 슬라이드 8의 표에만 있습니다.</p>
  <nav class="toc" aria-label="슬라이드 바로가기">${nav.map(([id, t]) => `<a href="#${id}">${t}</a>`).join('')}</nav>
</header>
${sec('s4', 4, '분석서는 도메인마다 3단으로 완결된다', fig('slide-04-analysis-structure', '기업 분석 자료는 6개 영역이고, 영역 하나는 실무 상세, 분석 결과, 결론의 3단으로 완결된다.'), '5-1 기업 분석 자료')}
${sec('s5', 5, '실무 지도 — 두 개의 관계와 계약 종료', fig('slide-05-business-map', '본사와 위탁센터는 계약 관계, 위탁센터와 직원·이용자는 운영 관계다. 계약이 종료된 지점은 신규 회원·예약·게시글이 막힌다.'), '1-1 공통설계서 §2-1')}
${sec('s6', 6, '분석 → 설계 → 구현 추적', t6, '4-3 §2 슬라이드 6 · 2-3 추적표 §2-4')}
${sec('s7', 7, '확장 지도와 판단 프레임', fig('slide-07-domain-hub', 'RFP 원본 8개 도메인에 자원문서관리를 신설했고, 넣고 뺄지는 네 가지 질문 순서로 가렸다.'), '2-3 추적표 §2-4')}
${sec('s8', 8, '판단 사례 — 넣은 것, 뺀 것, 남긴 것', t8, '2-3 추적표 §2-4 "범위 제외 결정"')}
${sec('s9', 9, '공통 뼈대 — 4개 역할과 지점 격리', t9 + fig('slide-09-guard-path', '요청은 로그인, 역할, 지점의 세 관문을 차례로 통과한다. 다른 지점의 데이터는 마지막 관문에서 막힌다.'), '1-2 권한관리 §3')}
${sec('s10', 10, '인사·근태 — 본사 채용, 현장 파견, 자동 판정', fig('slide-10-hr-attendance', '직원은 본사가 채용해 지점에 파견한다. 근태는 출근 시각으로 정상·지각을 가리고, 연차만 승인 시 잔여일수에서 차감된다.'), '1-3 인사정보관리 · 1-4 근태관리')}
${sec('s11', 11, '회원·강사·프로그램 — 관계와 상태 전이', fig('slide-11-member-program', '지점 아래에 회원·강사·프로그램이 있고, 프로그램은 정해진 순서로만 상태가 바뀌며 진행중일 때만 예약할 수 있다.'), '1-8 강사프로그램게시 §3-2')}
${sec('s12', 12, '예약·결제 — 흐름과 취소 정책', fig('slide-12-reservation', '예약은 결제를 거쳐 확정되고, 취소하면 회차 시작 24시간 전을 기준으로 환불 여부가 갈린다.'), '1-7 예약및결제 §6')}
${sec('s14', 14, '게시판 범위와 혼잡도 5단계', fig('slide-14-board-congestion', '게시글은 본사 공지와 지점 공지로 나뉘고, 혼잡도는 현재 인원을 정원으로 나눈 비율로 5단계가 정해진다.'), '1-5 게시판 · 1-9 혼잡도관리 §4')}
${sec('s15', 15, '자원문서관리 — 자동 분류와 보존기한', fig('slide-15-asset-document', '취득가액 100만원을 기준으로 자산이 자동 분류되고, 폐기까지의 흐름과 문서 종류별 보존기한이 정해져 있다.'), '1-10 자원문서관리 §4·§5')}
</div>`;

fs.writeFileSync(path.join(__dirname, 'viz.html'), html, 'utf8');
console.log('HTML bytes:', Buffer.byteLength(html));
console.log('SVG files:', fs.readdirSync(outDir).join(', '));
console.log(lib.WARN.length ? '경고 ' + lib.WARN.length + '건\n' + lib.WARN.join('\n') : '경고 없음');
