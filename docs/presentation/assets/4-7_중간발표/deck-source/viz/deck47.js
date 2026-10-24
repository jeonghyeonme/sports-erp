// 중간보고서 덱(읽는 덱) — 지도교수가 혼자 넘겨 읽는다(D67). 구성안: docs/presentation/4-7_중간발표_슬라이드구성.md
// 디자인은 6주차 생성기(../../4-6_6주차발표/deck-source/viz/deck46.js)와 같은 언어 — 색·글꼴·카드·알약을 그대로 옮겼다.
// 1차(2026-10-23): 맞물림 지도·시나리오를 먼저 확인받고, 2차에서 Ⅰ~Ⅶ 전체를 이었다.
// Ⅳ장 표의 "구현한 것"은 RFP 이행 증빙과 같은 문장(scripts/deliverables/rfp-plain.json), 판정은 요구사항추적표 §3에서 읽는다.
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

// 장 구분 — Ⅰ~Ⅶ 로마 숫자와 "이 장을 보면 아는 것" 한 줄
function partSlide(id, no, name, know, notes = '') {
  section(id, { bg: NAVY, ink: '#F4F5F3', pad: '128px 176px', gap: 24, notes },
    `<div style="flex:1"></div>` +
    `<p style="font-family:${MONO}; font-size:28px; font-weight:600; letter-spacing:4px; color:#B9C7D8">${no}</p>` +
    `<h1 style="font-family:${DISPLAY}; font-size:110px; font-weight:900; line-height:1.05; letter-spacing:-2px; color:#F4F5F3">${name}</h1>` +
    `<p style="font-size:40px; font-weight:500; line-height:1.4; color:#D7E0EA">${know}</p>` +
    `<div style="flex:1"></div>`);
}
const card = (inner, extra = '') => `<div style="display:flex; flex-direction:column; gap:12px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; padding:30px; box-shadow:${SHADOW}; ${extra}">${inner}</div>`;
const STATUS_C = { 완료: [GREEN_SOFT, GREEN], 조정: [NAVY_SOFT, NAVY], 부분: [AMBER_SOFT, AMBER], 제외: [GRAY_SOFT, GRAY], '해당 없음': [BG, GRAY] };
const spill = (s, n) => { const [b, c] = STATUS_C[s]; return pill(n == null ? s : `${s} ${n}`, b, c, s === '해당 없음' ? `border:1px solid ${LINE_STRONG}` : ''); };
const bigNum = (n, unit, cap, c = NAVY) => `<div style="display:flex; flex-direction:column; gap:6px"><p style="font-family:${DISPLAY}; font-size:88px; font-weight:800; line-height:1; color:${c}; font-variant-numeric:tabular-nums">${n}<span style="color:${SOFT}">${unit}</span></p>${ptxt(cap, 26)}</div>`;

// ── RFP 판정 원천(요구사항추적표 §3)과 쉬운 말 한 줄(rfp-plain.json — RFP 이행 증빙과 같은 문장) ──
const ROOT = path.join(__dirname, '..', '..', '..', '..', '..', '..');
const PLAIN = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/deliverables/rfp-plain.json'), 'utf8'));
const VERDICT = { 구현: '완료', 조정: '조정', 부분: '부분', 미구현: '제외', '해당 없음': '해당 없음' };
const CLAUSES = (() => {
  const md = fs.readFileSync(path.join(ROOT, 'docs/reference/요구사항추적표.md'), 'utf8');
  const s = md.indexOf('### 3-1.'), e = md.indexOf('\n## ', s + 1);
  const out = [];
  for (const line of md.slice(s, e).split('\n')) {
    const c = line.split('|').slice(1, -1).map((x) => x.trim());
    if (c.length !== 5 || c[0] === 'ID' || c[0].startsWith('---')) continue;
    out.push({ id: c[0], rfp: c[1], text: c[2], status: VERDICT[c[3]], plain: PLAIN[c[0]].plain });
  }
  if (out.length !== 72) throw new Error(`추적표 §3 조항 수가 72가 아님: ${out.length}`);
  return out;
})();
const count = (list, s) => list.filter((c) => c.status === s).length;
const STATES = ['완료', '조정', '부분', '제외', '해당 없음'];

// ════════════════════════════════════════════════════════════════════════
// Ⅰ 들어가며 — 한 장 요약, 읽는 법
// ════════════════════════════════════════════════════════════════════════
{
  const all = CLAUSES;
  const box = (k, t, d) => card(label(k) + h3(t, 34) + d, 'flex:1');
  section('summary', { notes: '한 장 요약. 무엇을: 아파트·오피스텔 커뮤니티 시설을 위탁받아 운영하는 회사(스포이즘)의 본사·지점·회원 시스템. 누구를 위해: 본사 관리자, 지점 관리자, 직원(관리자 웹), 회원(휴대폰 웹). RFP: 원문 글머리 하나를 한 조항으로 나눠 72조항 — 판정 원천은 요구사항추적표 §3이고 조항별 증거는 RFP 이행 증빙(PDF). 확인: 실DB 위 API 자동 테스트, 역할별 화면 자동 테스트, 운영 환경 성능 측정, 시연 데이터로 화면 점검. 다음: 실운영은 하지 않는다 — 기능을 늘리기보다 사용감을 다듬고, 계약서 OCR·AI 분석 적용을 검토하고, 회원 앱 형태를 다시 판단한다.' },
    head('Ⅰ. 들어가며 · 한 장 요약', '위탁운영 회사의 본사·지점·회원 시스템을 만들었습니다') +
    fill(`<div style="display:grid; grid-template-columns:1fr 1fr; gap:20px">` +
      box('무엇을', '위탁운영 계약 현장을 관리하는 ERP', ptxt('아파트·오피스텔 커뮤니티 시설을 맡아 운영하는 회사 — 지점은 매장이 아니라 계약 현장', 26)) +
      box('누구를 위해', '본사 · 지점 관리자 · 직원 · 회원', ptxt('관리자 웹은 직원 계정, 회원은 휴대폰 웹 앱', 26)) +
      box('RFP를 어디까지', `${all.length}개 조항`, `<div style="display:flex; flex-wrap:wrap; gap:10px">${STATES.map((s) => spill(s, count(all, s))).join('')}</div>`) +
      box('어떻게 확인했나', '자동 테스트 · 운영 측정 · 화면 점검', ptxt('API 테스트 556건(실DB) · 화면 자동 테스트 14건 · 운영 부하 측정', 26)) +
      `</div>` +
      bridge('다음 — 실운영은 하지 않고, 사용감 확보 · 계약서 OCR·AI 검토 · 회원 앱 형태 재검토', NAVY, NAVY_SOFT, 'PaperPlane')));

  const gRow = (no, name, know) => `<div style="display:flex; align-items:center; gap:24px; padding:14px 24px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:12px"><p style="font-family:${MONO}; font-size:26px; font-weight:700; color:${NAVY}; width:48px">${no}</p><p style="font-family:${DISPLAY}; font-size:30px; font-weight:700; color:${INK}; width:300px">${name}</p><p style="font-size:26px; color:${SOFT}">${know}</p></div>`;
  const file = (ic, t, d) => `<div style="display:flex; gap:16px; align-items:flex-start">${icon(ic, NAVY, 32)}<div style="display:flex; flex-direction:column; gap:4px">${h3(t, 28)}${ptxt(d, 24)}</div></div>`;
  section('guide', { notes: '읽는 법. 맥락(Ⅱ)까지만 읽어도 이 시스템이 무엇이고 기능들이 어떻게 맞물리는지 알 수 있게 짰다. Ⅳ의 표는 RFP 원문 순서이고, 조항마다 화면과 결정 기록은 함께 낸 RFP 이행 증빙(PDF)에 있다. 주차별 발표자료는 그 주에 발표한 덱을 그대로 낸 것이고, 이 보고서의 Ⅵ장은 그 요약과 6주차 이후(어느 발표에도 없던 작업)를 펼친 것이다.' },
    head('Ⅰ. 들어가며 · 이 보고서 읽는 법', '맥락만 보려면 Ⅱ장까지 읽으면 됩니다') +
    `<div style="flex:1; display:flex; gap:32px; align-items:center">` +
      `<div style="flex:1; display:flex; flex-direction:column; gap:10px">` +
        gRow('Ⅱ', '맥락', '무엇을 왜 — 사업 구조, 맞물림 지도, 하루 시나리오') +
        gRow('Ⅲ', '설계', '깨지면 안 되는 규칙 3개와 그것을 지키는 구조') +
        gRow('Ⅳ', 'RFP 이행 현황', '원문 72조항을 조항마다 — 무엇을 했나') +
        gRow('Ⅴ', '확인', '자동 테스트 · 운영 측정 · 보안 점검') +
        gRow('Ⅵ', '진행 경과', '언제 무엇을 — 6주차 이후는 펼쳐서') +
        gRow('Ⅶ', '마무리', '바꾼 것 · 남은 것 · 다음 계획 · 직접 써 보기') +
      `</div>` +
      card(label('함께 낸 파일') +
        file('CheckCircle', 'RFP 이행 증빙(PDF)', '조항별 쉬운 말 한 줄 · 화면 · 결정 기록') +
        file('Book', '주차별 발표자료', '1~6주차·종합 발표 덱') +
        file('Database', '산출물', '요구사항·데이터 정의서, 제안서, 설계서, 매뉴얼, 진행 보고서 5부'), 'width:620px') +
    `</div>`);
}

// ════════════════════════════════════════════════════════════════════════
// Ⅱ 맥락 — 사업 구조, 만든 것
// ════════════════════════════════════════════════════════════════════════
partSlide('p2', 'Ⅱ', '맥락', '무엇을, 왜 만들었고 기능들이 어떻게 맞물리나');
{
  const actor = (t, d, c, s) => `<div style="flex:1; display:flex; flex-direction:column; gap:8px; background:${s}; border:2px solid ${c}; border-radius:14px; padding:24px 22px">${h3(t, 34, c)}${ptxt(d, 25, INK)}</div>`;
  const rel = (t) => `<div style="width:150px; display:flex; flex-direction:column; align-items:center; gap:6px"><p style="font-size:24px; font-weight:600; color:${SOFT}; text-align:center">${t}</p><x-shape kind="arrow-right" style="background:${LINE_STRONG}; width:56px; height:28px"></x-shape></div>`;
  section('ctx-business', { notes: '스포이즘은 헬스장 체인이 아니라 아파트·오피스텔 커뮤니티 시설(헬스장·수영장·골프연습장·독서실)을 위탁받아 운영하는 회사다. 지점(Branch)은 소유 매장이 아니라 "OO아파트와 맺은 위탁운영 계약 현장"이고 계약 상대방·기간·상태(정상·갱신 임박·만료·종료)를 갖는다. 직원은 지점이 고용하지 않고 본사가 채용해 현장에 파견한다. 이용자는 등록 지점의 프로그램만 이용한다. 현장 운영 데이터(회원 수·매출·프로그램 실적)는 본사의 계약 갱신 판단 근거가 되고, 신규 수주 입찰 발표(PT)의 자료도 된다. RFP가 명시한 위험: 시스템 불안정 → 민원 → 계약 해지. 그래서 안정성은 품질 문제가 아니라 본사 매출(계약 개수) 문제다.' },
    head('Ⅱ. 맥락 · 사업 구조', '헬스장 체인이 아니라 위탁운영 계약 사업입니다') +
    fill(`<div style="display:flex; align-items:center">` +
      actor('본사', '계약을 따고 지키며, 직원을 채용한다', NAVY, NAVY_SOFT) + rel('위탁운영 계약') +
      actor('위탁센터(지점)', '아파트·오피스텔 커뮤니티 시설 — 계약 현장', NAVY, SURFACE) + rel('본사가 파견') +
      actor('직원', '파견된 현장에서 일상 운영', AMBER, AMBER_SOFT) + rel('서비스') +
      actor('이용자(회원)', '등록 지점의 프로그램을 이용', GREEN, GREEN_SOFT) +
      `</div>` +
      `<div style="display:flex; align-items:center; gap:16px; padding:18px 26px; background:${SURFACE}; border:2px dashed ${NAVY}; border-radius:12px">${icon('Activity', NAVY)}<p style="font-size:28px; color:${INK}">운영 데이터(회원 수 · 매출 · 프로그램 실적)가 다시 본사로 올라와 <b>계약 갱신과 신규 수주</b>의 근거가 된다</p></div>` +
      bridge('RFP가 밝힌 위험: 시스템 불안정 → 민원 → 계약 해지 — 안정성은 곧 계약(매출) 문제', '#9B2C2C', '#F9E7E5', 'Warning')));

  const stat = (n, u, cap) => `<div style="flex:1; display:flex; flex-direction:column; gap:4px; padding:20px 24px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:12px"><p style="font-family:${DISPLAY}; font-size:56px; font-weight:800; color:${NAVY}; font-variant-numeric:tabular-nums">${n}<span style="color:${SOFT}">${u}</span></p>${ptxt(cap, 24)}</div>`;
  const branch = (k, st, name) => `<div style="flex:1; display:flex; flex-direction:column; gap:10px; align-items:flex-start; padding:18px 20px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:12px">${spill(k)}${h3(name, 30)}${ptxt(st, 24)}</div>`;
  section('ctx-scope', { notes: '관리자 웹은 본사 관리자·지점 관리자·직원이 쓰고(회원 계정은 로그인할 수 없다, D66), 회원은 휴대폰 웹 앱(홈 화면에 설치 가능한 PWA, D40·D41)을 쓴다. 역할 4개, 업무 영역 9개. 설계 대상은 수도권 83개 지점이고, 시연·테스트 데이터는 계약 상태별 5개 지점(정상 서초·강남, 갱신 임박 마포, 만료 송파, 종료 노원)에 지난 90일 운영 이력을 넣었다(D58). 규모는 2026-10-23 코드에서 센 값: API 경로 103개, 관리자 웹 화면 21개, 회원 웹 화면 14개, DB 테이블 34개.' },
    head('Ⅱ. 맥락 · 만든 것', '관리자 웹과 회원 앱, 역할 4개, 업무 영역 9개') +
    fill(`<div style="display:flex; gap:20px">` +
      card(label('관리자 웹') + h3('본사 · 지점 관리자 · 직원', 34) + ptxt('지점·계약, 인사·근태, 회원·예약, 게시판, 자산·문서, 권한 — 직원 계정만 로그인', 26), 'flex:1') +
      card(label('회원 앱(휴대폰 웹)', GREEN) + h3('회원', 34) + ptxt('예약·모의 결제·취소, 혼잡도, 공지, 내 정보 — 홈 화면에 설치', 26), 'flex:1') +
      `</div>` +
      `<div style="display:flex; gap:14px">${stat(103, '개', 'API 경로')}${stat(21, '개', '관리자 웹 화면')}${stat(14, '개', '회원 웹 화면')}${stat(34, '개', 'DB 테이블')}</div>` +
      `<div style="display:flex; flex-direction:column; gap:10px">${label('시연 지점 — 계약 상태별 5곳')}<div style="display:flex; gap:12px">` +
        branch('완료', '정상', '서초점').replace(spill('완료'), pill('정상', GREEN_SOFT, GREEN)) +
        branch('완료', '정상', '강남점').replace(spill('완료'), pill('정상', GREEN_SOFT, GREEN)) +
        branch('부분', '갱신 임박', '마포점').replace(spill('부분'), pill('갱신 임박', AMBER_SOFT, AMBER)) +
        branch('제외', '만료', '송파점').replace(spill('제외'), pill('만료', GRAY_SOFT, GRAY)) +
        branch('완료', '종료 — 신규 차단', '노원점').replace(spill('완료'), pill('종료', NAVY, '#F4F5F3')) +
      `</div></div>`) +
    foot('설계 대상은 수도권 83개 지점 · 수치는 2026-10-23 코드 기준'));
}

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

// ════════════════════════════════════════════════════════════════════════
// Ⅲ 설계 — 복잡한 것을 어떻게 단단하게
// ════════════════════════════════════════════════════════════════════════
partSlide('p3', 'Ⅲ', '설계', '깨지면 안 되는 규칙 3개와, 그것을 한 곳에서 지키는 구조');
{
  const rule = (ic, t, d, from) => card(`<div style="display:flex; align-items:center; gap:14px">${icon(ic, NAVY, 40)}${h3(t, 38)}</div>` + ptxt(d, 27, INK) + `<div style="flex:1"></div>` + `<div style="padding:14px 18px; background:${NAVY_SOFT}; border-radius:10px">${ptxt('어디서 왔나 — ' + from, 24, NAVY, 600)}</div>`, 'flex:1');
  section('arch-rules', { notes: '세 규칙은 사업 구조에서 바로 나온다. 지점 격리: RFP가 "타현장 정보를 조회할 수 없게 하는 권한"을 명시했다. 서버의 전역 가드 한 곳이 경로·쿼리의 지점 id와 리소스의 주인 지점을 보고 막는다(D46) — 다른 지점 id로 공격하는 자동 테스트 표가 있다. 계약 종료 차단: 종료 지점은 회원 등록·예약·게시글 작성·채용·파견 발령이 409로 막히고 과거 조회는 유지, 만료·갱신 임박은 막지 않는다. 인사 권한 분리: 직원은 본사가 채용해 파견하므로 채용·재배치는 본사만, 지점 관리자는 파견된 인력의 일상 관리만. 세 규칙의 테스트가 실패하면 기대값을 바꾸지 않고 코드의 규칙 위반으로 본다(프로젝트 규칙).' },
    head('Ⅲ. 설계 · 깨지면 안 되는 규칙', '세 규칙이 모든 설계의 출발점입니다') +
    fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
      rule('Lock', '지점 데이터 격리', '지점 관리자는 자기 지점 데이터만 조회·수정한다. 다른 지점 주소는 서버가 막는다', 'RFP "타현장 정보 조회 불가"') +
      rule('Warning', '계약 종료 차단', '종료 지점은 신규 회원·예약·게시글·채용·발령이 막히고, 과거 조회는 남는다', '지점 = 위탁 계약') +
      rule('Users', '인사 권한 분리', '채용·재배치는 본사만. 지점 관리자는 파견된 인력의 일상 관리만', '본사 채용 → 현장 파견') +
      `</div>` +
      bridge('세 규칙은 자동 테스트가 매번 확인합니다 — 실패하면 기대값이 아니라 코드를 고칩니다', GREEN, GREEN_SOFT, 'CheckCircle')));

  const st = (t, d, c, s) => `<div style="flex:1; display:flex; flex-direction:column; gap:8px; padding:20px; background:${s}; border:2px solid ${c}; border-radius:12px">${h3(t, 30, c)}${ptxt(d, 24, INK)}</div>`;
  const ar = `<x-shape kind="arrow-right" style="background:${LINE_STRONG}; width:44px; height:24px"></x-shape>`;
  section('arch-data', { notes: '계약 상태 4단계: 정상 → 갱신 임박(종료일이 다가옴) → 만료(기간은 지났지만 갱신 협의 중일 수 있어 막지 않음), 종료(본사가 바꾸며, 이것만 신규 활동을 막는다). 계약 상태 변경은 본사 한 곳이고, 종료로 바꾸면 같은 처리(트랜잭션) 안에서 그 지점의 진행 중 파견이 끝나고 직원은 재배치 대기로 간다(ADR-STF-07·08). 직원은 계정(로그인) – 직원(인사 정보) – 파견(어느 지점에 언제부터 언제까지)으로 나눴다. 직원당 진행 중 파견은 1건이고 DB의 조건부 유일 인덱스가 강제한다. 근태는 그날 파견된 지점에 귀속돼 재배치 후에도 과거 기록이 원래 지점에 남는다. 규칙은 앱 검사와 DB 제약(CHECK 20 · 지점 일치 트리거 8 · 조건부 유일 3)으로 두 겹.' },
    head('Ⅲ. 설계 · 데이터', '지점은 계약으로, 직원은 파견으로 담았습니다') +
    fill(card(label('지점 = 계약 — 상태 4단계') +
        `<div style="display:flex; align-items:center; gap:12px">${st('정상', '평소 운영', GREEN, GREEN_SOFT)}${ar}${st('갱신 임박', '종료일 다가옴', AMBER, AMBER_SOFT)}${ar}${st('만료', '협의 중 — 막지 않음', GRAY, GRAY_SOFT)}${ar}${st('종료', '신규 활동 차단', NAVY, NAVY_SOFT)}</div>`) +
      card(label('직원 = 본사 소속 + 파견 이력', AMBER) +
        `<div style="display:flex; align-items:center; gap:12px">${st('계정', '로그인 · 역할', GRAY, SURFACE)}${ar}${st('직원', '본사가 채용', AMBER, AMBER_SOFT)}${ar}${st('파견', '어느 지점에, 언제부터 언제까지', AMBER, SURFACE)}${ar}${st('근태', '그날 파견된 지점에 귀속', AMBER, SURFACE)}</div>`) +
      bridge('계약을 종료하면 그 지점의 진행 중 파견도 같은 처리 안에서 끝나고, 직원은 재배치 대기로 갑니다', NAVY, NAVY_SOFT, 'Link')));

  section('arch-permission', { notes: 'RFP F1-2 "사용자별·프로그램별 권한 설정(입력·수정·삭제·조회·출력)". 처음에는 역할 4개로 고정했다가(D1), RFP 문구를 다시 대조해 세부 권한을 만들었다(D60이 D1을 대체). 역할이 상한이고 그 안에서 기능 15개 × 동작 5개를 역할 기본값으로 두며, 본사가 사람마다 예외를 줄 수 있다. 개인 예외도 역할 상한을 넘지 못한다. 판정은 서버의 전역 권한 가드가 하고(선언이 빠진 경로가 있으면 자동 테스트 실패), 관리자 웹은 같은 판정으로 메뉴·버튼·CSV 내려받기를 숨긴다 — 숨김은 편의이고 막는 것은 서버다. 권한 변경은 변경 이력에 남는다.' },
    head('Ⅲ. 설계 · 세부 권한', '권한을 사람과 기능 단위로 나눴습니다') +
    `<div style="flex:1; display:flex; gap:32px; align-items:center">` +
      `<div style="width:700px; display:flex; flex-direction:column; gap:16px">` +
        card(label('역할이 상한') + ptxt('본사 관리자 · 지점 관리자 · 직원 · 회원 — 개인 예외도 역할을 넘지 못한다', 26, INK)) +
        card(label('그 안에서 기능 × 동작') + ptxt('기능 15개 × 조회 · 입력 · 수정 · 삭제 · 출력, 역할 기본값 + 사람별 예외', 26, INK)) +
        card(label('판정은 서버, 화면은 숨김') + ptxt('권한이 없으면 메뉴 · 버튼 · CSV가 보이지 않고, 주소로 들어와도 서버가 거절한다', 26, INK)) +
      `</div>` +
      shot(browser('/_blob/9f37bc691a85e0a9b72802e07a18b443', '/permissions', 900, 562, '권한 관리 — 역할 기본 권한 표'), '권한 관리 화면', '지점 관리자 역할의 기본 권한 표') +
    `</div>`);

  const tier = (t, d, tech, c) => `<div style="flex:1; display:flex; flex-direction:column; gap:10px; padding:26px 22px; background:${SURFACE}; border:1px solid ${LINE}; border-top:6px solid ${c}; border-radius:14px; box-shadow:${SHADOW}">${h3(t, 32)}${ptxt(d, 25, INK)}<div style="flex:1"></div><p style="font-family:${MONO}; font-size:24px; color:${SOFT}">${tech}</p></div>`;
  const arr = `<div style="display:flex; align-items:center"><x-shape kind="arrow-right" style="background:${LINE_STRONG}; width:44px; height:24px"></x-shape></div>`;
  section('arch-system', { notes: '브라우저(관리자 웹·회원 웹) → 엣지(Cloudflare Worker: 화면 파일 제공, /api 요청 전달, 로그인 요청 제한) → 서버(AWS Lambda 서울: 요청마다 따로 실행, 동시 실행 상한 10, 넘치면 바로 503 안내) → DB(Supabase PostgreSQL 서울). 화면과 API를 한 주소로 묶어 교차 출처 문제를 없앴다. 지점 검사·권한 판정은 서버 길목 한 곳(D46·D60). 첫 배포(Render 공유 CPU)에서 동시 로그인 40명에 15초가 걸린 것을 측정해 실DB 전환과 Lambda 이관을 결정했다(D24·D26·D37). 배포는 dev 브랜치 push 때 자동(헬스체크 실패 시 이전 버전으로 되돌림).' },
    head('Ⅲ. 설계 · 시스템 구성', '요청 하나가 지나가는 길은 네 칸입니다') +
    fill(`<div style="display:flex; gap:12px; align-items:stretch">` +
      tier('브라우저', '관리자 웹(직원) · 회원 앱(휴대폰)', 'React', NAVY) + arr +
      tier('엣지', '화면 제공 · API 전달 · 로그인 요청 제한', 'Cloudflare Worker', NAVY) + arr +
      tier('서버', '모든 규칙 — 지점 격리 · 권한 판정 · 계약 차단이 여기 한 곳', 'AWS Lambda(서울) · NestJS', GREEN) + arr +
      tier('DB', '규칙을 한 번 더 — CHECK · 트리거 · 유일 인덱스', 'Supabase PostgreSQL(서울)', AMBER) +
      `</div>` +
      bridge('서버는 요청마다 따로 실행되고 동시 10개를 넘으면 바로 거절합니다 — 몰려도 느려지며 무너지지 않게', NAVY, NAVY_SOFT, 'Activity')));
}

// ════════════════════════════════════════════════════════════════════════
// Ⅳ RFP 이행 현황 — 조항마다 한 줄(RFP 이행 증빙과 같은 문장), 행이 많으면 장을 나눈다
// ════════════════════════════════════════════════════════════════════════
partSlide('p4', 'Ⅳ', 'RFP 이행 현황', '제안요청서 72조항을 원문 순서대로 — 무엇을 했고 어디까지인가');
{
  const all = CLAUSES;
  const box = (t, d) => card(h3(t, 30) + ptxt(d, 25), 'flex:1');
  section('rfp-method', { notes: 'RFP 원문 구조: 과업(p.3~4, 과업1 분석·과업2 설계·과업3 개발·과업4 매뉴얼·교육), 세부 과업 요구사항 표(p.5 기능·성능, p.6 시스템·데이터·인터페이스·보안·사업지원·제약 — 원문 번호 9는 원문에도 없다), 산출물(p.7), 개념도(p.4). 표 칸 안의 글머리(•) 하나를 한 조항으로 세어 72조항이 됐다. 판정은 요구사항추적표 §3 한 곳에만 있고, 이 덱과 RFP 이행 증빙·요구사항 정의서는 거기서 가져온다. 판정은 자기 평가라서 조항마다 화면 캡처와 결정 기록을 증거로 붙였다(RFP 이행 증빙 PDF).' },
    head('Ⅳ. RFP 이행 · 나눈 방법', '원문 글머리 하나를 한 조항으로 — 72조항') +
    fill(`<div style="display:flex; gap:16px">` +
      box('과업 p.3~4', '분석 · 설계 · 개발 · 매뉴얼·교육') +
      box('요구사항 표 p.5', '기능 8개 항목 · 성능 2개 항목') +
      box('요구사항 표 p.6', '시스템 · 데이터 · 인터페이스 · 보안 · 사업지원 · 제약') +
      box('산출물 p.7 · 개념도 p.4', '제출 문서 5종 · 본사↔현장 흐름') +
      `</div>` +
      card(label('이행 상태 5가지') + `<div style="display:grid; grid-template-columns:200px 1fr; gap:12px 20px; align-items:center">` +
        [['완료', 'RFP가 말한 것을 그대로 했다'], ['조정', '결과는 냈고 방식을 바꿨다 — 이유가 결정 기록에 있다'], ['부분', '일부만 했다 — 실운영을 하지 않아 범위 밖으로 둔 것'], ['제외', '의도적으로 하지 않았다'], ['해당 없음', '발주기관·계약·대면 행위처럼 대상이 없다']]
          .map(([s, d]) => `<div style="display:flex">${spill(s)}</div>${ptxt(d, 26, INK)}`).join('') + `</div>`) +
      bridge('판정은 자기 평가라, 조항마다 화면과 결정 기록을 증거로 붙였습니다 — RFP 이행 증빙(PDF)', NAVY, NAVY_SOFT, 'Verified')));

  const AREAS = [
    ['기능·성능', 'p.5', (c) => /^F/.test(c.id)],
    ['시스템~제약', 'p.6', (c) => /^N/.test(c.id)],
    ['과업·산출물·개념도', 'p.3~4 · p.7', (c) => /^[TPC]/.test(c.id)],
  ];
  const cell = (s, n) => `<td style="text-align:right">${n || '·'}</td>`;
  const rate = (l) => `${Math.round(((count(l, '완료') + count(l, '조정')) / l.length) * 100)}%`; // 완료+조정 비율 — 분모는 그 행의 조항 수 전부(증빙서와 같다)
  const rows = AREAS.map(([a, pg, f]) => { const l = all.filter(f); return `<tr><td style="white-space:nowrap">${a} <span style="color:${SOFT}">${pg}</span></td><td style="text-align:right"><b>${l.length}</b></td>${STATES.map((s) => cell(s, count(l, s))).join('')}<td style="text-align:right; color:${GREEN}"><b>${rate(l)}</b></td></tr>`; }).join('');
  const total = `<tr style="background:${SURFACE2}"><td><b>합계</b></td><td style="text-align:right"><b>${all.length}</b></td>${STATES.map((s) => `<td style="text-align:right"><b>${count(all, s)}</b></td>`).join('')}<td style="text-align:right; color:${GREEN}"><b>${rate(all)}</b></td></tr>`;
  section('rfp-count', { notes: '영역별 조항 수(요구사항추적표 §3, 2026-10-23). 완료+조정 비율은 그 행의 조항 수 전부를 분모로 한다(해당 없음·제외도 빼지 않는다) — 전체 58/72 = 81%, 기능·성능 28/29 = 97%(남은 1개는 원문이 "추후 논의"로 남긴 해당 없음). 시스템~제약의 부분 2개는 결제의 금융기관 연계 확인(테스트 키 실제 호출 전)과 개인정보 업무위탁 계약서 — 둘 다 실운영이 있어야 끝난다. 과업의 부분 1개는 발주기관 검수·도입·기대효과 분석. 제외 3개는 유사기업 분석 둘과 도입 후 기대효과 분석 — 접근할 자료가 없고, 실데이터 없이 숫자를 지어내지 않으려고 뺐다. 해당 없음 8개는 발주기관·납품 계약·대면 교육처럼 대상이 없는 조항.' },
    head('Ⅳ. RFP 이행 · 영역별 조항 수', `${all.length}조항 중 완료 ${count(all, '완료')} · 조정 ${count(all, '조정')} — 완료·조정 ${rate(all)}`) +
    fill(`<div style="background:${SURFACE}; border:1px solid ${LINE}; border-radius:14px; padding:20px 32px; box-shadow:${SHADOW}">` +
      `<table style="font-size:32px; color:${INK}; font-family:${BODY}"><tr><th style="width:28%; text-align:left; color:${SOFT}">영역</th><th style="width:8%; text-align:right; color:${SOFT}">조항</th>${STATES.map((s) => `<th style="width:${s === '해당 없음' ? 13 : 8.5}%; text-align:right; white-space:nowrap; color:${STATUS_C[s][1]}">${s}</th>`).join('')}<th style="width:17%; text-align:right; white-space:nowrap; color:${GREEN}">완료+조정 비율</th></tr>${rows}${total}</table></div>` +
      `<div style="display:flex; gap:16px">` +
        card(h3('부분 3 · 제외 3', 30) + ptxt('부분은 실운영이 있어야 끝나는 조항, 제외는 자료 없이 숫자를 지어내지 않으려고 뺀 분석 — Ⅶ장에서 자세히', 25), 'flex:1') +
        card(h3('해당 없음 8', 30) + ptxt('발주기관 승인·납품 계약·하자보수·대면 교육처럼 이 프로젝트에 대상이 없는 조항', 25), 'flex:1') +
      `</div>`));

  // 조항 표 — 열: 조항 · RFP 원문 · 구현한 것 · 상태. 높이를 어림해 넘치면 다음 장으로.
  const W_TEXT = 520, W_PLAIN = 850;
  const lines = (s, w) => Math.ceil([...s].length * 22 / w); // 24px 글자 평균 폭 ≈ 22px(한글 24 · 공백·문장부호는 좁다)
  const rowH = (c) => Math.max(lines(c.text, W_TEXT), lines(c.plain, W_PLAIN)) * 34 + 18;
  const BUDGET = 720; // 제목 아래부터 쪽 번호 띠 위까지(표 머리 제외)
  const tRow = (c, first) =>
    `<div style="display:flex; gap:16px; align-items:flex-start; padding:9px 16px; background:${SURFACE}; ${first ? '' : `border-top:1px solid ${LINE}; `}">` +
    `<p style="width:84px; font-family:${MONO}; font-size:24px; font-weight:600; color:${NAVY}">${c.id}</p>` +
    `<p style="width:${W_TEXT}px; font-size:24px; line-height:1.4; color:${SOFT}">${esc(c.text)}</p>` +
    `<p style="width:${W_PLAIN}px; font-size:24px; line-height:1.4; color:${INK}">${esc(c.plain)}</p>` +
    `<div style="width:130px; display:flex; justify-content:flex-end">${spill(c.status)}</div></div>`;
  const grpHead = (name) => `<div style="display:flex; gap:12px; align-items:center; padding:8px 16px; background:${SURFACE2}; border-top:1px solid ${LINE}"><p style="font-family:${DISPLAY}; font-size:26px; font-weight:700; color:${INK}">${esc(name)}</p></div>`;
  const tHead = `<div style="display:flex; gap:16px; padding:8px 16px; background:${BG}"><p style="width:84px; font-size:24px; color:${SOFT}">조항</p><p style="width:${W_TEXT}px; font-size:24px; color:${SOFT}">RFP가 요구한 것(원문 요약)</p><p style="width:${W_PLAIN}px; font-size:24px; color:${SOFT}">구현한 것</p><p style="width:130px; font-size:24px; color:${SOFT}; text-align:right">상태</p></div>`;
  function rfpTables(key, area, pageNote, list, titleOf, notes) {
    const pages = [];
    let cur = [], h = 0, lastRfp = null;
    for (const c of list) {
      const need = rowH(c) + (c.rfp !== lastRfp ? 44 : 0);
      if (h + need > BUDGET && cur.length) { pages.push(cur); cur = []; h = 0; lastRfp = null; }
      const g = c.rfp !== lastRfp;
      cur.push({ c, g }); h += rowH(c) + (g ? 44 : 0); lastRfp = c.rfp;
    }
    if (cur.length) pages.push(cur);
    pages.forEach((pg, i) => {
      const id = pages.length > 1 ? `${key}-${i + 1}` : key;
      const sub = pages.length > 1 ? ` (${i + 1}/${pages.length})` : '';
      const body = pg.map(({ c, g }, j) => (g ? grpHead(c.rfp) : '') + tRow(c, g || j === 0)).join('');
      section(id, { notes },
        head(`Ⅳ. RFP 이행 · ${area}${sub}`, titleOf(list)) +
        `<p style="position:absolute; right:96px; top:72px; font-family:${MONO}; font-size:24px; color:${SOFT}">RFP ${pageNote}</p>` +
        `<div style="display:flex; flex-direction:column; border:1px solid ${LINE}; border-radius:12px; overflow:hidden; box-shadow:${SHADOW}">${tHead}${body}</div>` +
        foot('조항별 화면·결정 기록은 함께 낸 RFP 이행 증빙(PDF)의 같은 조항 번호'));
    });
  }
  const sum = (l) => STATES.filter((s) => count(l, s)).map((s) => `${s} ${count(l, s)}`).join(' · ');
  const byId = (re) => all.filter((c) => re.test(c.id));
  rfpTables('rfp-func', '기능', 'p.5 기능 1~8', byId(/^F[1-8]-/), (l) => `기능 ${l.length}조항 — ${sum(l)}`,
    '기능 요구(권한·인사·근태·게시판·회원·예약결제·강사프로그램·혼잡도). 조정 2개: 모바일 결제는 실제 PG 대신 모의 결제(상태 전이·결제/취소 경합은 실물처럼, D5·D6·ADR-RSV-07), 혼잡도 "실시간 또는 30분 이내"는 계측 장비 없이 진행 중 강습 예약 인원 자동 + 현장 인원 직원 입력(ADR-FAC-05). 해당 없음 1개는 원문이 "결제내역 처리 방법 추후 논의"로 미확정인 조항.');
  rfpTables('rfp-perf', '성능', 'p.5 성능 10~11', byId(/^F1[01]-/), (l) => `성능 ${l.length}조항 — ${sum(l)}, 숫자로 확인`,
    '조정 1개: CPU 평균 90% 이하 — Lambda는 요청마다 따로 실행돼 CPU를 나눠 쓰지 않으므로 CPU 대신 요청당 처리 시간(운영 실측 약 40ms)으로 봤다(D37·D50). 메모리는 실측 최대 167MB/1,024MB(약 16%)이고 5분 평균 85% 초과 시 이메일 경보를 운영에 적용했다. 과부하 300 rps 시나리오에서 실제 처리 약 80~90 rps(측정 PC 한계 포함), 넘친 요청은 즉시 503.');
  const nList = byId(/^N/);
  const na = nList.filter((c) => c.status === '해당 없음');
  const merged = [...nList.filter((c) => c.status !== '해당 없음'), { id: na.map((c) => c.id.split('-')[0]).filter((v, i, a) => a.indexOf(v) === i).join('·'), rfp: '시스템도입 · 설치및운영 · 하자보수', text: '도입 승인 · 작업계획서 승인 · 발주기관 검증 · 기술지원 확약 · 무상 보증 · 업그레이드', plain: `발주기관·납품 계약이 없어 대상이 없다(${na.length}조항). 검증은 자동 검사(코드 검사·테스트·문서 검사)로 대신했다.`, status: '해당 없음' }];
  rfpTables('rfp-sys', '시스템~제약', 'p.6', merged, () => `시스템~제약 ${nList.length}조항 — ${sum(nList)}`,
    '부분 2개는 실운영이 있어야 끝난다 — 결제의 금융기관 연계 확인(결제 회사를 바꿔 끼우는 구조와 연계 확인 문서까지, 테스트 키 실제 호출 전)과 개인정보보호법 제26조 업무위탁(처리방침의 위탁 고지·절차 문서까지, 위탁 계약서 서명·감독 기록은 실운영 때). 조정 1개: "페이지 위치 정보를 MAP 형태로"를 화면 위 경로 표시로 해석했다(D51). 해당 없음 6개는 발주기관·납품 계약이 없는 조항이라 한 줄로 묶었다.');
  rfpTables('rfp-task', '과업·산출물·개념도', 'p.3~4 · p.7 · 개념도 p.4', byId(/^[TPC]/), (l) => `과업·산출물·개념도 ${l.length}조항 — ${sum(l)}`,
    '제출물 이름까지 적었다. 조정 2개: 산출물1 "ERP 앱 1개"는 관리자 웹 + 회원 모바일 웹(홈 화면 설치)으로(D40·D41·D45), 산출물3 개발 작업계획서는 아키텍처 설계서와 업무 영역별 작업 절차로. 제외 3개는 유사 기업체 시스템 분석·유사기업 매뉴얼 분석(접근 불가)과 도입 후 기대효과 분석(실데이터 없는 수치 예측) — 의도적 제외. 부분 1개는 발주기관 검수·도입·기대효과 분석이 없는 과업3 흐름. 해당 없음 1개는 팀장급 대면 교육.');
}

// ════════════════════════════════════════════════════════════════════════
// Ⅴ 어떻게 확인했나
// ════════════════════════════════════════════════════════════════════════
partSlide('p5', 'Ⅴ', '확인', '규칙은 자동 테스트로, 성능은 운영에서 재고, 보안은 점검표로');
{
  const check = (ic, t, d) => card(`<div style="display:flex; align-items:center; gap:12px">${icon(ic, GREEN, 34)}${h3(t, 32)}</div>` + ptxt(d, 25, INK), 'flex:1');
  section('verify-tests', { notes: 'API 자동 테스트는 52개 파일 556건이고 실제 PostgreSQL 위에서 돈다(테스트마다 기준 DB를 복제). 지점 격리는 다른 지점 id로 공격하는 케이스 표를 모든 지점 단위 경로에 대해 돌리고, 리소스 선언이 빠진 경로가 있으면 실패한다. 계약 종료 차단, 인사 권한 분리, 동시성(정원 2명 회차에 동시 요청 → 정확히 2건, 결제와 취소 동시 처리, 겹치는 휴가)을 본다. 화면 자동 테스트(Playwright) 14건은 역할별 핵심 경로(본사 대시보드·지점 상세, 회원 등록, 회차 등록, 공지·첨부, 근태, 세부 권한, 처리 대기함, 첫 로그인 변경, 회원 계정 거부, 혼잡도, 회원 예약·결제·취소 등)를 빌드 결과로 본다. 그 밖의 화면은 lint·빌드와 시연 데이터 점검까지만. PR마다 CI가 모두 돌고, 커밋 전에도 같은 검사가 돈다.' },
    head('Ⅴ. 확인 · 자동 테스트', '깨지면 안 되는 규칙은 자동 테스트가 지킵니다') +
    fill(`<div style="display:flex; gap:24px">` +
      card(bigNum(556, '건', 'API 자동 테스트 — 실제 DB 위에서(52개 파일)', GREEN), 'flex:1') +
      card(bigNum(14, '건', '화면 자동 테스트 — 역할별 핵심 경로', NAVY), 'flex:1') +
      `</div><div style="display:flex; gap:16px">` +
      check('Lock', '지점 격리', '다른 지점 주소로 공격하는 표를 모든 지점 경로에') +
      check('Warning', '계약 종료 차단', '종료 지점의 신규 활동 409, 과거 조회 유지') +
      check('Users', '동시성', '정원 · 결제와 취소 · 겹치는 휴가 — 동시에 보내도 맞게') +
      `</div>` +
      bridge('화면 자동 테스트 밖의 화면은 시연 데이터로 직접 점검까지 했습니다', GRAY, GRAY_SOFT, 'Search')));

  const meas = (t, from, to, d) => card(label(t) + `<p style="font-family:${DISPLAY}; font-size:60px; font-weight:800; color:${INK}">${from}<span style="color:${SOFT}"> → </span><span style="color:${GREEN}">${to}</span></p>` + ptxt(d, 25), 'flex:1');
  section('verify-perf', { notes: '모두 운영 환경(AWS Lambda 서울 + Supabase 서울)에서 k6로 쟀다. 첫 배포(Render 공유 CPU)에서 동시 로그인 40명에 로그인 p95 15.16초 → 실DB 전환과 Lambda 이관 뒤 같은 시나리오 237ms. 그 뒤 처리 시간이 가정의 두 배(약 110ms)인 원인을 측정해 DB 풀러 모드의 작업당 왕복으로 확인하고 접속 방식을 Session pooler로 바꿔 약 40ms(D48~D50). 과부하 300 rps × 1분에서 실제 처리 약 80~90 rps(측정 PC가 먼저 막혀 하한), 넘친 요청은 즉시 503. 메모리 실측 최대 167MB/1,024MB. 남은 위험: 순간 몰림 때 일부 요청 거절(로그인 몰림 1,866건 중 38건 등) — 실운영을 하지 않기로 해 원인 확인은 하지 않았다.' },
    head('Ⅴ. 확인 · 운영 측정', '운영에서 재 보고, 원인을 찾아 고쳤습니다') +
    fill(`<div style="display:flex; gap:20px">` +
      meas('동시 로그인 40명 — p95', '15.16초', '237ms', '공유 서버 → 실DB · Lambda 이관') +
      meas('요청당 처리 시간', '약 110ms', '약 40ms', 'DB 접속 방식을 측정해 바꿈') +
      `</div><div style="display:flex; gap:20px">` +
      card(label('과부하 300 rps × 1분') + ptxt('실제 처리 약 80~90 rps, 넘친 요청은 즉시 거절(503)', 27, INK), 'flex:1') +
      card(label('메모리') + ptxt('최대 약 16%(167MB / 1,024MB), 85% 경보 운영 적용', 27, INK), 'flex:1') +
      `</div>` +
      bridge('남은 위험: 순간 몰림 때 일부 거절 — 실운영을 하지 않아 원인 확인은 하지 않았습니다', AMBER, AMBER_SOFT, 'Warning')));

  section('verify-security', { notes: '개발보안: 행정안전부 구현단계 보안약점 49개 항목으로 점검 — 대응 37, 부분 1(계정별 로그인 제한은 수용), 해당 없음 11. 점검 중 문서 주소 입력의 XSS를 찾아 고쳤다. 의존성: 운영 의존성의 알려진 취약점 18건 → 같은 메이저 안에서 4건(D63) → NestJS 11·react-router 7 업그레이드로 0건(D65). 업그레이드 직후 Express 5의 쿼리 처리 변화로 지점 격리 필터가 빠지는 결함을 기존 격리 테스트 16건이 잡아 설정 한 곳에서 고쳤다. 보안관리계획(인원·문서·장비·비밀값·위탁, 약점 10건과 조치). 계정: 채용 직원은 무작위 임시 비밀번호 + 첫 로그인 변경 강제, 새 비밀번호는 영문·숫자 8~72자. 운영: dev push 시 자동 배포(헬스체크 실패면 이전 버전), Lambda 오류·지연·메모리 경보와 예산 경보.' },
    head('Ⅴ. 확인 · 보안과 운영', '점검표로 보고, 알려진 취약점은 0건입니다') +
    fill(`<div style="display:grid; grid-template-columns:1fr 1fr; gap:20px">` +
      card(label('개발보안 점검') + h3('49항목 — 대응 37', 36) + ptxt('행정안전부 구현단계 보안약점 기준, 점검 중 찾은 XSS 수정', 25)) +
      card(label('의존성 취약점') + h3('18건 → 0건', 36) + ptxt('업그레이드 직후 격리 결함은 기존 테스트가 잡았다', 25)) +
      card(label('계정') + h3('임시 비밀번호 · 첫 로그인 변경', 32) + ptxt('채용 직원 무작위 비밀번호, 새 비밀번호는 영문·숫자 8~72자', 25)) +
      card(label('운영') + h3('자동 배포 · 경보', 32) + ptxt('실패하면 이전 버전으로, 오류·지연·메모리·예산 경보', 25)) +
      `</div>`));
}

// ════════════════════════════════════════════════════════════════════════
// Ⅵ 진행 경과 — 1~6주차는 요약(주차별 발표자료), 6주차 이후는 펼친다
// ════════════════════════════════════════════════════════════════════════
partSlide('p6', 'Ⅵ', '진행 경과', '언제 무엇을 — 6주차 발표 이후는 처음 보이는 작업이라 펼쳐서');
{
  const tl = (date, t, d, file, hot) => `<div style="flex:1; display:flex; flex-direction:column; gap:10px; background:${hot ? NAVY_SOFT : SURFACE}; border:1px solid ${LINE}; border-top:6px solid ${hot ? AMBER : NAVY}; border-radius:14px; padding:22px 18px; box-shadow:${SHADOW}">${label(date, hot ? AMBER : NAVY)}${h3(t, 28)}${ptxt(d, 24)}<div style="flex:1"></div>${file ? `<p style="font-size:24px; color:${NAVY}">${file}</p>` : ''}</div>`;
  section('prog-timeline', { notes: '발표 날짜: 1주차 9/7(첫 진행 발표), 2주차 9/14, 3주차 9/21, 4주차 9/28, 종합 발표 10/5, 6주차 10/11. 1~6주차 발표 덱은 주차별 발표자료로 함께 냈다. 6주차 이후(10/12~10/23) 작업은 어떤 발표에도 나온 적이 없어 다음 장부터 펼친다.' },
    head('Ⅵ. 진행 경과 · 전체 타임라인', '여섯 번 발표했고, 그 뒤 두 주를 더 했습니다') +
    fill(`<div style="display:flex; gap:12px; align-items:stretch">` +
      tl('9/7', '1주차', '요구사항 분석 · 인증·도메인 뼈대', '1주차 발표자료') +
      tl('9/14', '2주차', '실무 분석 · 도메인 확장 · 지점 격리', '2주차 발표자료') +
      tl('9/21', '3주차', '분석 → 계획 → 9개 도메인 구현', '3주차 발표자료') +
      tl('9/28', '4주차', '도메인 재점검 · 첫 배포 · 부하 측정', '4주차 발표자료') +
      tl('10/5', '종합', '실DB 전환 · Lambda 이관 · 전체 정리', '종합 발표자료') +
      tl('10/11', '6주차', '회원 앱 · RFP 보강 · 격리 중앙화 · 성능 원인', '6주차 발표자료') +
      tl('~10/23', '이후', 'RFP 재대조 · 시연 데이터 · 세부 권한 · 품질 · 산출물', '이 보고서 Ⅵ장', true) +
      `</div>`));

  const wk = (t, d) => `<div style="display:flex; flex-direction:column; gap:6px; padding:18px 22px; background:${SURFACE}; border:1px solid ${LINE}; border-left:6px solid ${NAVY}; border-radius:10px">${h3(t, 28)}${ptxt(d, 24)}</div>`;
  section('prog-weeks', { notes: '1~6주차 요약. 자세한 내용과 그때의 수치는 주차별 발표자료에 있다. 분석·설계: RFP를 헬스장 체인이 아니라 위탁운영사로 재해석하고, 요구사항 추적표와 도메인 9개 설계, 디자인 기준을 만들었다. 구현: 3주차까지 9개 도메인을 인메모리 데이터로 구현하고, 4주차에 도메인마다 근거 → 대안 → 결정 → 구현 → 검증 사이클로 다시 돌며 불변식 위반 결함을 고쳤다. 첫 배포(Render)에서 동시 로그인 40명에 15초를 측정했다. 그 결과로 전 도메인을 실DB로 옮기고(가짜 데이터 서비스 삭제, DB 제약 추가), API를 AWS Lambda(서울)로 옮겼다. 그다음 대상 지점을 수도권 83개로 정하고 회원 기능을 모바일 웹으로 만들었으며, 처리 시간이 가정의 두 배인 원인을 측정해 DB 접속 방식을 바꿨다.' },
    head('Ⅵ. 진행 경과 · 1~6주차 요약', '분석에서 시작해, 측정한 문제를 구조로 풀었습니다') +
    fill(`<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px">` +
      wk('분석 · 설계(1~3주차)', 'RFP를 위탁운영사로 재해석 · 요구사항 추적표 · 도메인 9개 설계 · 디자인 기준') +
      wk('구현과 재점검(3~4주차)', '9개 도메인 구현 → 도메인마다 근거·대안·결정·검증 사이클로 결함 수정') +
      wk('첫 배포와 측정(4주차)', '공유 서버에서 동시 로그인 40명에 15초 — 추측 대신 숫자') +
      wk('실DB · 서버 이관(종합)', '가짜 데이터 서비스를 걷어 내고 실DB로, API는 요청별로 도는 Lambda로') +
      wk('범위 재설정 · 회원 앱(6주차)', '수도권 83개 지점, 회원 기능은 휴대폰 웹으로') +
      wk('성능 원인(6주차)', 'DB 접속 방식을 측정해 바꿔 요청당 약 110 → 40ms') +
      `</div>`) +
    foot('자세히는 함께 낸 주차별 발표자료'));

  const domPill = (t, k) => { const [c, s] = G[k]; return pill(t, s, c); };
  section('after-rfp', { notes: '6주차 이후 RFP 원문을 문구 단위로 다시 대조해(D51 — "페이지 위치" = 경로 표시 등 해석 결정), 빠졌거나 화면이 없던 것을 채웠다. 인사: 직원 상세 한 화면(인사기록), 본인 인사 변경 신청 → 지점 관리자 승인(ADR-STF-09). 근태: 관리자 정정·누락일 등록(ADR-ATT-04), 본사 근태 현황, 업무일지 관리자 열람. 회원 서비스: 프로그램 종목·연령대·시간대 필터(ADR-PRG-04), 회원 웹 강사 소개, 예약 달력(관리자 주간 시간표·회원 날짜 띠, ADR-RSV-06), 혼잡도 30분 경고. 공통: 목록 CSV 출력(D54), 변경 이력 확대(D52), 느린 요청 안내(D55), 경로 표시, 회원 웹 이용 안내·개인정보처리방침. 소통: 직원 교육자료 탭·첨부(D57), 업무지원 요청(D56).' },
    head('Ⅵ. 6주차 이후 · RFP 재대조', 'RFP를 문구 단위로 다시 대조해 빠진 16가지를 채웠습니다') +
    fill(`<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px">` +
      card(label('인력', AMBER) + `<div style="display:flex; flex-wrap:wrap; gap:10px">${['인사기록 한 화면', '인사 변경 신청 승인', '근태 정정', '본사 근태 현황', '업무일지 열람'].map((t) => domPill(t, 'staff')).join('')}</div>`) +
      card(label('회원 서비스', GREEN) + `<div style="display:flex; flex-wrap:wrap; gap:10px">${['프로그램 필터', '강사 소개', '예약 달력', '혼잡도 30분 경고'].map((t) => domPill(t, 'member')).join('')}</div>`) +
      card(label('공통') + `<div style="display:flex; flex-wrap:wrap; gap:10px">${['CSV 출력', '변경 이력 확대', '느린 요청 안내', '경로 표시', '회원 앱 이용 안내'].map((t) => domPill(t, 'contract')).join('')}</div>`) +
      card(label('소통', GRAY) + `<div style="display:flex; flex-wrap:wrap; gap:10px">${['교육자료 탭·첨부', '업무지원 요청'].map((t) => domPill(t, 'talk')).join('')}</div>`) +
      `</div>` +
      bridge('"MAP 형태의 페이지 위치"처럼 모호한 문구는 해석을 결정 기록으로 남기고 구현했습니다', NAVY, NAVY_SOFT, 'Book')));

  const fstep = (t, d) => `<div style="flex:1; display:flex; flex-direction:column; gap:6px; padding:18px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:12px">${h3(t, 28)}${ptxt(d, 24)}</div>`;
  const fa = `<div style="display:flex; align-items:center"><x-shape kind="arrow-right" style="background:${LINE_STRONG}; width:36px; height:20px"></x-shape></div>`;
  section('after-support', { notes: 'RFP 개념도(p.4)의 "현장 → 본사 업무지원 요청"은 처음 설계에 없었다. 새 테이블을 만들었다(D56) — 지점 관리자가 분류(시설·인력·기타)와 내용을 올리고, 본사가 처리중 → 완료 또는 반려로 바꾼다. 반려는 답변이 필수(DB 제약). 본사 대시보드 처리 대기함에 처리할 요청 수가 뜬다. 화면은 본사의 처리 창.' },
    head('Ⅵ. 6주차 이후 · 업무지원 요청', '현장이 본사에 요청하는 길을 새로 냈습니다') +
    `<div style="flex:1; display:flex; gap:32px; align-items:center">` +
      `<div style="width:720px; display:flex; flex-direction:column; gap:18px">` +
        `<div style="display:flex; gap:8px">${fstep('현장 요청', '지점 관리자 — 분류와 내용')}${fa}${fstep('본사 처리', '처리중 → 완료 / 반려')}</div>` +
        card(label('규칙') + ptxt('반려하려면 답변을 꼭 남긴다(DB가 강제) · 처리할 요청 수가 본사 처리 대기함에 뜬다', 25, INK)) +
        ptxt('RFP 개념도(p.4)의 "현장 → 본사" 흐름 — 처음 설계에 없던 것을 재대조로 찾았다', 25) +
      `</div>` +
      shot(browser(IMG.hqSupport, '/support-requests', 880, 550, '업무지원 요청 처리 창'), '본사의 처리 창', '강남점 요청 — 처리중·완료·반려와 답변') +
    `</div>`);

  section('after-dense', { notes: '이전 시연 데이터는 지점 이름표 수준이었다. 시드 지점을 계약 상태별 5곳으로 줄이고(정상 서초·강남, 갱신 임박 마포, 만료 송파, 종료 노원), 실행일 기준 지난 90일 이력과 앞으로 3주 회차를 결정적으로 넣었다(D58). 회원 211명, 예약·결제 약 5천 건, 근태·업무일지·휴가·자산·문서·업무지원 요청까지. 자동 테스트도 데이터 양이 결과를 좌우하는 것(성능·목록·격리)은 이 고밀도 데이터를 템플릿으로 쓴다. 배포 DB도 같은 데이터로 다시 채웠다(승인 후).' },
    head('Ⅵ. 6주차 이후 · 시연 데이터', '시연 데이터를 "운영 중인 지점"처럼 채웠습니다') +
    fill(`<div style="display:flex; gap:20px">` +
      card(bigNum(5, '곳', '계약 상태별 지점 — 정상 2 · 갱신 임박 · 만료 · 종료'), 'flex:1') +
      card(bigNum(90, '일', '지난 운영 이력 + 앞으로 3주 회차(실행일 기준)'), 'flex:1') +
      card(bigNum(211, '명', '회원 — 예약·결제 약 5천 건'), 'flex:1') +
      `</div>` +
      card(label('함께 채운 것') + ptxt('직원 근태·업무일지·휴가 · 자산·문서 · 업무지원 요청 · 변경 이력 — 화면마다 실제 같은 양으로', 26, INK)) +
      bridge('같은 데이터로 화면을 점검했고, 양이 결과를 좌우하는 자동 테스트도 이 데이터에서 돕니다', GREEN, GREEN_SOFT, 'Database')));

  const defect = (t, risk, fix) => card(h3(t, 32) + `<div style="display:flex; flex-direction:column; gap:8px"><p style="font-size:24px; font-weight:600; color:#9B2C2C">위험 — ${risk}</p><p style="font-size:24px; font-weight:600; color:${GREEN}">고침 — ${fix}</p></div>`, 'flex:1');
  section('after-defects', { notes: '운영 사고가 아니라 코드 읽기와 시나리오로 찾은 위험이다. 셋 다 먼저 실패하는 테스트를 만들어 재현하고, 고쳐서 통과시켰다. 결제·취소 동시 처리: 같은 예약에 결제와 취소가 동시에 오면 둘 다 성공할 수 있었다 → 예약 행을 같은 순서로 먼저 잠근다(ADR-RSV-07). 갱신 토큰 재사용: 같은 갱신 토큰으로 두 요청이 동시에 오면 둘 다 새 토큰을 받을 수 있었다 → 원자적으로 폐기(ADR-AUTH-06). 휴가 이중 차감: 겹치는 휴가 두 건이 동시에 승인되면 연차가 두 번 빠질 수 있었다 → 직원 행을 잠그고 겹침을 검사(ADR-ATT-05).' },
    head('Ⅵ. 6주차 이후 · 숨은 결함', '숨은 결함을 먼저 재현하고 고쳤습니다') +
    fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
      defect('결제와 취소가 동시에', '둘 다 성공해 결제된 취소 예약', '예약을 같은 순서로 먼저 잠근다') +
      defect('갱신 토큰 재사용', '같은 토큰으로 새 토큰 두 개', '토큰을 한 번에 폐기한다') +
      defect('겹치는 휴가 승인', '연차가 두 번 빠진다', '직원을 잠그고 겹침을 검사한다') +
      `</div>` +
      bridge('셋 다 "실패하는 테스트를 먼저 만들고 → 고쳐서 통과" — 운영 사고가 아니라 미리 찾은 위험입니다', NAVY, NAVY_SOFT, 'Search')));

  section('after-qa', { notes: '방법: 고밀도 시연 데이터로 역할별 핵심 경로 15화면을 실제로 눌러 보고(휴대폰 폭 포함), 화면 밀도·깨짐과 속도를 쟀다(log/125). 발견 14건(중 5 · 확인 필요 1 · 하 8)을 모두 고쳤다. 대표: 출퇴근 시각이 기기 시간대를 따라 UTC 기기에서 뒤집혀 보임 → 한국 시간 고정. 갱신 임박 지점 상세에 운영 실적이 없음 → 최근 3개월 운영 실적 추가(오른쪽 화면). 대시보드 상단의 추세 수치가 가짜 값 → 실제 값으로. 예약 1,657건이 83쪽인데 필터가 없음 → 날짜·상태 필터. 그 밖에 상태가 영어 코드로 보이던 것, 낡은 안내 문구 등.' },
    head('Ⅵ. 6주차 이후 · 화면 점검', '시연 데이터로 직접 눌러 보고 14건을 모두 고쳤습니다') +
    `<div style="flex:1; display:flex; gap:32px; align-items:center">` +
      `<div style="width:720px; display:flex; flex-direction:column; gap:12px">` +
        ptxt('역할별 핵심 경로 15화면 · 실제 양의 데이터 · 휴대폰 폭', 26, INK, 600) +
        [['출퇴근 시각이 기기 시간대를 따름', '한국 시간으로 고정'], ['갱신 임박 지점에 운영 실적 없음', '최근 3개월 실적 추가'], ['대시보드 추세가 가짜 값', '실제 값으로'], ['예약 1,657건에 필터 없음', '날짜·상태 필터']]
          .map(([a, b]) => `<div style="display:flex; flex-direction:column; gap:4px; padding:14px 20px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:10px"><p style="font-size:25px; color:${INK}">${a}</p><p style="font-size:24px; font-weight:600; color:${GREEN}">→ ${b}</p></div>`).join('') +
      `</div>` +
      shot(browser(IMG.hqMapo, '/branches/branch-mapo', 880, 550, '마포점 운영 실적'), '마포점(갱신 임박) 상세', '고친 뒤 — 계약 정보와 최근 3개월 운영 실적') +
    `</div>`);

  const small = (t, d, rfp) => card(`<div style="display:flex; justify-content:space-between; gap:12px; align-items:center">${h3(t, 30)}${pill(rfp, NAVY_SOFT, NAVY)}</div>` + ptxt(d, 24), 'flex:1');
  section('after-permission', { notes: '세부 권한(D60, RFP F1-2·N7-2): 서버 판정 → 관리 화면·변경 이력 → 관리자 웹 메뉴·버튼·CSV 숨김의 3단계로 만들었다. 처리 대기함(D61): 대시보드 첫 카드에 역할별 "지금 처리할 일" 건수(휴가 승인·인사 변경 신청·결근 확정·업무지원 요청·갱신 임박 지점 등), 메뉴와 상단 배지. 시설별 공지(RFP F4-3, ADR-BRD-05): 지점 공지에 대상 시설을 지정하고 회원 앱이 시설로 거른다. 서식 편집기(D62): 게시글 작성·수정 화면, 서버 허용 목록 정화 + 두 웹의 정화로 두 겹.' },
    head('Ⅵ. 6주차 이후 · 권한과 사용성', '세부 권한 · 처리 대기함 · 시설별 공지 · 서식 편집기') +
    `<div style="flex:1; display:flex; gap:24px; align-items:stretch">` +
      card(`<div style="display:flex; justify-content:space-between; align-items:center">${h3('세부 권한', 34)}${pill('RFP F1-2', NAVY_SOFT, NAVY)}</div>` + ptxt('서버 판정 → 관리 화면·변경 이력 → 메뉴·버튼 숨김, 3단계로', 25) +
        `<img src="/_blob/9f37bc691a85e0a9b72802e07a18b443" alt="권한 관리 — 역할 기본 권한 표" style="width:820px; height:513px; object-fit:contain; border:1px solid ${LINE}; border-radius:8px; background:${SURFACE}">`, 'width:880px') +
      `<div style="flex:1; display:flex; flex-direction:column; gap:16px">` +
        small('처리 대기함', '역할별 "지금 처리할 일" 건수와 메뉴 배지', '사용성') +
        small('시설별 공지', '공지에 시설을 지정, 회원 앱이 시설로 거른다', 'RFP F4-3') +
        small('서식 편집기', '게시글 서식·이미지, 위험한 내용은 두 겹으로 거른다', '교육 자료') +
      `</div>` +
    `</div>`);

  const q = (t, d) => `<div style="display:flex; gap:14px; align-items:flex-start">${icon('Check', GREEN)}<div style="display:flex; flex-direction:column; gap:4px"><p style="font-size:28px; font-weight:600; color:${INK}">${t}</p>${ptxt(d, 24)}</div></div>`;
  section('after-quality', { notes: '화면 자동 테스트 도입(D59, Playwright — 빌드 결과를 운영과 같은 구조로 띄워 역할별 핵심 경로, CI 전용). 배포 DB를 시연과 같은 고밀도 데이터로 다시 채웠다(승인 후, 로컬 복제 DB에서 2회 실행·지문 비교 절차). 보안 남은 조치(ADR-AUTH-08): 정수 입력 상한, 새 비밀번호 영문·숫자 8~72자, 채용 직원 무작위 임시 비밀번호 + 첫 로그인 변경 강제. 의존성 취약점: 운영 18 → 4(D63) → NestJS 11·react-router 7 업그레이드로 0(D65). 업그레이드 직후 Express 5의 쿼리 처리 변화로 지점 관리자에게 다른 지점 목록이 보이는 결함이 생겼는데, 기존 격리 테스트가 잡아 기대값을 바꾸지 않고 설정 한 곳에서 고쳤다.' },
    head('Ⅵ. 6주차 이후 · 품질과 보안', '품질과 보안을 다졌습니다') +
    fill(`<div style="display:grid; grid-template-columns:1fr 1fr; gap:24px 40px">` +
      q('화면 자동 테스트 도입', '역할별 핵심 경로 — 7건에서 시작해 14건') +
      q('배포 DB를 시연 데이터로', '로컬 복제에서 두 번 돌려 비교한 뒤 적용') +
      q('채용 직원 임시 비밀번호', '무작위 발급 + 첫 로그인에서 변경 강제') +
      q('비밀번호 규칙', '영문·숫자 섞어 8~72자') +
      q('의존성 취약점 0건', '운영 18 → 4 → 0, 메이저 업그레이드') +
      q('업그레이드 결함을 테스트가 잡음', '다른 지점 목록이 보이던 것을 바로 발견') +
      `</div>`));

  section('after-final', { notes: '관리자 웹은 직원 계정만(D66): 회원 계정으로 로그인하면 발급된 토큰을 바로 폐기하고 회원 앱으로 안내한다. 관리자 웹의 회원용 화면 코드도 지웠다. 혼잡도(ADR-FAC-05): 혼잡도 = 지금 진행 중인 강습 회차의 예약 인원(조회 때 계산) + 예약 외 현장 인원(직원 입력). 입장 기록(키오스크) 방식은 설계했지만 RFP 요구를 넘어 보류. 문서 산출물: 사용자 매뉴얼(Word, 역할별), 교육 자료 빠른 시작(PDF, 운영 게시판 직원 교육자료 탭에 탑재), 단계별 진행 보고서 5부, 그리고 모든 산출물을 10/23 사실로 다시 생성. 이 중간보고 묶음: 이 덱 + RFP 이행 증빙 + 주차별 발표자료 + 산출물(D67).' },
    head('Ⅵ. 6주차 이후 · 마지막 정리', '역할을 정리하고, 혼잡도를 예약과 잇고, 문서를 냈습니다') +
    fill(`<div style="display:grid; grid-template-columns:1fr 1fr; gap:20px">` +
      card(label('관리자 웹은 직원만') + ptxt('회원 계정은 로그인 단계에서 막고 회원 앱으로 안내', 26, INK)) +
      card(label('혼잡도 = 예약 + 현장', GREEN) + ptxt('진행 중 강습의 예약 인원은 자동, 예약 없이 온 인원은 직원 입력', 26, INK)) +
      card(label('문서 산출물', AMBER) + ptxt('사용자 매뉴얼 · 교육 자료(게시판 탑재) · 진행 보고서 5부, 전부 10/23 기준으로 재생성', 26, INK)) +
      card(label('이 중간보고 묶음', GRAY) + ptxt('이 보고서 · RFP 이행 증빙 · 주차별 발표자료 · 산출물', 26, INK)) +
      `</div>`));
}

// ════════════════════════════════════════════════════════════════════════
// Ⅶ 마무리 — 바꾼 것 · 남은 것 · 다음 계획 · AI 협업 · 직접 써 보기
// ════════════════════════════════════════════════════════════════════════
partSlide('p7', 'Ⅶ', '마무리', '방식을 바꾼 것과 남은 것, 그리고 다음 계획');
{
  const adjRows = [
    ['F6-1', '모바일 결제', '모의 결제 — 상태 전이·경합은 실물처럼', '실제 PG 계약이 없다'],
    ['F8-2', '혼잡도 실시간·30분 이내', '강습 예약 인원 자동 + 현장 인원 직원 입력', '계측 장비가 없다'],
    ['F10-1', 'CPU 평균 90% 이하', '요청당 처리 시간으로 측정', '요청마다 따로 실행돼 CPU를 나눠 쓰지 않는다'],
    ['N6-3', '페이지 위치를 MAP 형태로', '화면 위 경로 표시', '모호한 문구를 해석해 기록'],
    ['P1', 'ERP 앱 1개', '관리자 웹 + 회원 휴대폰 웹', '같은 기술로 한 사람이 운영'],
    ['P3', '개발 작업계획서', '아키텍처 설계서 + 작업 절차', '실제 진행과 맞는 문서로'],
  ];
  section('end-adjust', { notes: '조정 6건 모두 결정 기록이 있다. F6-1: D5·D6·ADR-RSV-07 — 결제 회사를 바꿔 끼울 수 있는 구조(ADR-RSV-03). F8-2: D10·ADR-FAC-05. F10-1: D37·D50. N6-3: D51. P1: D40·D41·D45. P3: log/062 — 아키텍처 설계서와 도메인 사이클 템플릿으로 대체.' },
    head('Ⅶ. 마무리 · 방식을 바꾼 것', '방식을 바꾼 6건 — 모두 이유가 기록돼 있습니다') +
    `<div style="display:flex; flex-direction:column; border:1px solid ${LINE}; border-radius:12px; overflow:hidden; box-shadow:${SHADOW}">` +
      `<div style="display:flex; gap:16px; padding:10px 20px; background:${BG}">${['조항', 'RFP가 말한 것', '우리가 한 것', '이유'].map((t, i) => `<p style="width:${[100, 400, 620, 520][i]}px; font-size:24px; color:${SOFT}">${t}</p>`).join('')}</div>` +
      adjRows.map((r, j) => `<div style="display:flex; gap:16px; align-items:flex-start; padding:16px 20px; background:${SURFACE}; ${j ? `border-top:1px solid ${LINE}` : ''}">` +
        `<p style="width:100px; font-family:${MONO}; font-size:24px; font-weight:600; color:${NAVY}">${r[0]}</p><p style="width:400px; font-size:26px; color:${SOFT}">${r[1]}</p><p style="width:620px; font-size:26px; font-weight:600; color:${INK}">${r[2]}</p><p style="width:520px; font-size:26px; color:${INK}">${r[3]}</p></div>`).join('') +
    `</div>`);

  const gap3 = (k, t, items, why) => card(`<div style="display:flex; align-items:center; gap:14px">${spill(k)}${h3(t, 32)}</div>` + `<div style="display:flex; flex-direction:column; gap:8px">${items.map((x) => ptxt('· ' + x, 25, INK)).join('')}</div><div style="flex:1"></div>` + ptxt(why, 24, SOFT, 600), 'flex:1');
  section('end-gap', { notes: '부분 3: N7-3 결제의 금융·보안기관 연계 가능 여부 확인 — 결제 어댑터 설계와 PG 연계 확인 문서까지, 테스트 키 실제 호출은 하지 않음. N8-2 개인정보보호법 제26조 업무위탁 — 처리방침의 위탁 고지·위탁 문서 항목·감독 절차까지, 위탁 계약서(DPA) 서명·보관·감독 기록은 실운영 때. T3-2 개발 → 테스트 → 검수 → 도입 → 기대효과 분석 — 개발·테스트·운영 배포까지. 실운영을 하지 않기로 해(D67) 범위 밖으로 둔다. 제외 3: T2-1 유사 기업체 관리 시스템 분석, P2-3 유사기업 직원 매뉴얼 분석(벤치마킹 대상 접근 불가), P2-2 도입 후 기대효과 분석(실제 매출·계약 데이터 없이 숫자를 만들면 근거 없는 추정). 해당 없음 8: 도입 승인·작업계획서 승인·발주기관 검증·기술지원 확약·무상 보증·업그레이드·결제내역 처리(원문 미확정)·대면 교육.' },
    head('Ⅶ. 마무리 · 남은 것과 뺀 것', '남은 것은 실운영이 필요하고, 뺀 것은 지어내지 않으려고') +
    fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
      gap3('부분', '3조항', ['결제 회사 실제 연계(테스트 키 호출)', '개인정보 위탁 계약서 서명', '발주기관 검수·도입'], '실운영을 하지 않아 범위 밖으로 둡니다') +
      gap3('제외', '3조항', ['유사 기업체 시스템 분석', '유사기업 직원 매뉴얼 분석', '도입 후 기대효과(매출·계약) 예측'], '자료 없이 숫자를 지어내지 않으려고') +
      gap3('해당 없음', '8조항', ['발주기관 승인·검증·확약', '하자보수·업그레이드 약정', '대면 교육 · 원문 미확정 1'], '이 프로젝트에 대상이 없습니다') +
      `</div>`));

  const plan = (no, t, d, c) => `<div style="flex:1; display:flex; flex-direction:column; gap:12px; background:${SURFACE}; border:1px solid ${LINE}; border-top:6px solid ${c}; border-radius:14px; padding:28px; box-shadow:${SHADOW}">${label(no, c)}${h3(t, 34)}${ptxt(d, 25, INK)}</div>`;
  section('next-all', { notes: '실운영은 하지 않는다(D67). 다음은 세 갈래이고 모두 계획 수준이다 — 무엇을 검토할지와 기준까지만 정했다. ① 사용감 확보: 지금 기능 대부분은 데이터 등록·조회·처리라, 직접 쓰는 사람이 편하도록 다듬는다. ② 계약서 OCR·AI 분석: RFP 조항이 아니라 우리가 더한 차별화 제안(차별화전략 §1-1). ③ 회원 앱 형태: 휴대폰 웹(PWA)의 접근성 한계 때문에 다시 판단한다(D40 재검토).' },
    head('Ⅶ. 마무리 · 다음 계획', '기능을 늘리기보다, 쓰기 좋게 — 세 갈래를 검토합니다') +
    fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
      plan('①', '사용감 확보', '목록 · 검색 · 정렬을 고르게, 수치는 그림으로, 자주 하는 작업은 단계를 줄인다', NAVY) +
      plan('②', '계약서 OCR · AI 분석 검토', '계약서를 읽어 계약 정보를 채우고, 관리자가 확인해 반영', AMBER) +
      plan('③', '회원 앱 형태 재검토', '설치·접근이 어려운 휴대폰 웹 — 하이브리드·네이티브 앱과 비교', GREEN) +
      `</div>` +
      bridge('실운영은 하지 않습니다 — 계획은 "무엇을, 어떤 기준으로 검토할지"까지입니다', GRAY, GRAY_SOFT, 'Lightbulb')));

  const two = (l, r) => `<div style="display:flex; gap:20px; align-items:stretch">${l}${r}</div>`;
  section('next-ux', { notes: '지금 기능 대부분은 데이터 등록·조회·처리(CRUD)다. 실제로 매일 쓰는 사람이 편하도록 다듬는 것이 다음 일이다. 목록: 일부(회원·예약·결제·자산)는 이미 서버가 20건씩 나눠 주지만(D43), 검색·정렬·필터가 화면마다 다르다 — 같은 방식으로 맞춘다. 시각화: 대시보드와 지점 운영 실적이 지금은 숫자·표 — 추이를 차트로. 단계 줄이기: 회원 등록 → 수강 등록, 회차 열기처럼 자주 하는 작업의 클릭 수를 줄인다. 계획 수준.' },
    head('Ⅶ. 다음 계획 ① · 사용감 확보', '직접 쓰는 사람이 편하도록 다듬습니다') +
    fill(two(
      card(label('지금') + ptxt('기능 대부분이 데이터 등록 · 조회 · 처리 — 화면마다 목록 방식이 조금씩 다르고, 수치는 숫자와 표', 27, INK), 'flex:1'),
      card(label('검토할 것', GREEN) + `<div style="display:flex; flex-direction:column; gap:10px">${['목록 쪽 나누기 · 검색 · 정렬을 화면마다 같은 방식으로', '대시보드 · 운영 실적을 차트로', '자주 하는 작업의 단계 줄이기'].map((t) => `<div style="display:flex; gap:12px; align-items:flex-start">${icon('Check', GREEN, 28)}<p style="font-size:27px; color:${INK}">${t}</p></div>`).join('')}</div>`, 'flex:1'))));

  const flow = (t) => `<div style="flex:1; padding:18px; background:${SURFACE}; border:1px solid ${LINE}; border-radius:12px"><p style="font-size:26px; font-weight:600; color:${INK}; text-align:center">${t}</p></div>`;
  const fA = `<div style="display:flex; align-items:center"><x-shape kind="arrow-right" style="background:${LINE_STRONG}; width:36px; height:20px"></x-shape></div>`;
  section('next-ai', { notes: '계약서 OCR·AI 분석(차별화전략 §1-1). 흐름: 계약서 스캔본을 올리면 글자를 인식하고 계약 상대방·기간 등을 뽑아 관리자에게 제안하고, 관리자가 확인한 뒤 반영한다. 자동 반영하지 않는 이유: 계약 상태는 신규 활동 차단(종료)·갱신 판단의 근거라 잘못 읽은 값이 그대로 퍼진다. 검토할 점: 인식률(스캔 품질·표 형식), 로컬 모델과 외부 API의 비용·정확도, 계약서에 든 개인정보를 외부로 보내도 되는지(위탁 문제). 지점 상세의 계약 정보 칸은 이를 전제로 이미 있다(D22). 계획 수준이고 RFP 조항이 아니다.' },
    head('Ⅶ. 다음 계획 ② · 계약서 OCR · AI 분석', '계약서를 읽어 채우되, 반영은 사람이 합니다') +
    fill(`<div style="display:flex; gap:8px">${flow('계약서 스캔본 올리기')}${fA}${flow('글자 인식')}${fA}${flow('상대방·기간 추출')}${fA}<div style="flex:1; padding:18px; background:${AMBER_SOFT}; border:2px solid ${AMBER}; border-radius:12px"><p style="font-size:26px; font-weight:700; color:${AMBER}; text-align:center">관리자 확인 후 반영</p></div></div>` +
      two(
        card(label('자동 반영하지 않는 이유', AMBER) + ptxt('계약 상태는 신규 활동 차단과 갱신 판단의 근거 — 잘못 읽은 값이 그대로 퍼진다', 26, INK), 'flex:1'),
        card(label('검토할 점') + ptxt('인식률 · 로컬 모델과 외부 서비스의 비용·정확도 · 계약서 속 개인정보를 밖으로 보내도 되나', 26, INK), 'flex:1')) +
      ptxt('RFP 조항이 아니라 차별화 제안 — 지점 상세의 계약 정보 칸은 이미 이것을 전제로 있다', 25)));

  const opt = (t, d, c) => card(h3(t, 32, c) + ptxt(d, 25, INK), 'flex:1');
  section('next-app', { notes: '지금 회원 기능은 휴대폰 웹(PWA, D40·D41·D45) — 같은 기술·같은 주소로 인프라를 더 붙이지 않으려는 결정이었다. 문제: 홈 화면 설치 방법이 브라우저마다 다르고, 카카오톡 같은 인앱 브라우저에서는 설치·로그인 유지가 제한되며, 푸시 알림도 기기마다 다르다. 대안: 웹을 감싼 하이브리드 앱(코드 재사용이 크고 스토어 배포 가능) / 네이티브 앱(접근성·기능은 가장 좋지만 코드를 새로 짜야 함). 비교 기준: 접근성 · 코드 재사용 · 스토어 배포 · 비용. D40을 다시 판단하는 일이고 계획 수준이다.' },
    head('Ⅶ. 다음 계획 ③ · 회원 앱 형태', '휴대폰 웹의 접근성 한계를 다시 판단합니다') +
    fill(card(label('지금 — 휴대폰 웹(홈 화면 설치)') + ptxt('설치 방법이 브라우저마다 다르고, 메신저 안 브라우저에서는 설치와 로그인 유지가 제한된다', 26, INK)) +
      `<div style="display:flex; gap:20px">` +
        opt('휴대폰 웹 유지', '인프라 그대로, 접근성 한계도 그대로', GRAY) +
        opt('하이브리드 앱', '지금 웹을 감싸 스토어 배포 — 코드 재사용이 크다', NAVY) +
        opt('네이티브 앱', '접근성·기능은 가장 좋지만 새로 짠다', GREEN) +
      `</div>` +
      ptxt('비교 기준 — 접근성 · 코드 재사용 · 스토어 배포 · 비용', 27, INK, 600)));

  const col = (no, t, d) => `<div style="flex:1; display:flex; flex-direction:column; gap:10px; background:${SURFACE}; border:1px solid ${LINE}; border-top:6px solid ${NAVY}; border-radius:14px; padding:26px; box-shadow:${SHADOW}">${label(no)}${h3(t, 32)}${ptxt(d, 25, INK)}</div>`;
  section('ai-method', { notes: 'AI(Claude Code)와 대화로 개발했다. 사람이 매번 diff를 보지 않아도 방향을 잡을 수 있게 세 겹을 뒀다. 결정 전: 어느 결정 기록(D 번호·도메인 ADR)에 근거하는지 먼저 인용하고, 없으면 대안·트레이드오프를 먼저 남긴다. 커밋 전: 세 앱의 lint·빌드와 API 자동 테스트, 문서 검사(링크·ID·크기 상한)가 커밋을 막는다. PR마다 CI가 같은 검사와 화면 자동 테스트를 돈다. 기록: 현재 상태(STATUS)·진행 기록(log, 170여 건)·결정 기록(D 67개 + 도메인 ADR) — 한 사실은 한 곳에. 상위 목표는 AI 활용·실무 노하우와 도메인 지식 습득이 먼저, 포트폴리오 품질은 그다음(D53).' },
    head('Ⅶ. 마무리 · AI와 함께 개발한 방식', 'AI가 만든 것을 검사와 기록이 붙잡는 구조') +
    fill(`<div style="display:flex; gap:20px; align-items:stretch">` +
      col('결정 전', '근거부터 인용', '어느 결정 기록에 근거하는지 먼저 밝히고, 없으면 대안과 이유를 먼저 남긴다') +
      col('커밋 전 · PR', '기계가 막는다', 'lint · 빌드 · 자동 테스트 · 문서 검사 — 실패하면 커밋도 병합도 안 된다') +
      col('기록', '한 사실은 한 곳에', '현재 상태 · 진행 기록 · 결정 기록 — 언제든 "왜 이렇게 됐나"를 따라간다') +
      `</div>` +
      bridge('상위 목표 — AI 활용과 실무 노하우·도메인 지식 습득이 먼저, 포트폴리오 품질은 그다음', NAVY, NAVY_SOFT, 'GraduationCap')));

  const try3 = (who, c, steps) => card(h3(who, 32, c) + `<div style="display:flex; flex-direction:column; gap:8px">${steps.map((s, i) => `<p style="font-size:26px; color:${INK}"><b>${i + 1}</b>&nbsp; ${s}</p>`).join('')}</div>`, 'flex:1');
  section('demo', { notes: '배포 주소에서 직접 써 볼 수 있다. 로그인 화면의 데모 계정 버튼을 누르면 비밀번호 입력 없이 들어간다. 시연 데이터는 공용이라 다른 사람이 바꿔 놓았을 수 있다(예약·공지 등). 회원 웹은 같은 주소 뒤에 /m/을 붙인다 — 휴대폰으로 열면 홈 화면에 설치할 수 있다. 실운영 서비스가 아니라 시연용이다.' },
    head('Ⅶ. 마무리 · 직접 써 보기', '데모 계정 버튼만 누르면 들어갑니다') +
    fill(card(`<div style="display:flex; flex-direction:column; gap:10px">` +
        `<div style="display:flex; gap:16px; align-items:center">${label('관리자 웹')}<p style="font-family:${MONO}; font-size:28px; font-weight:600; color:${INK}">https://sports-erp-api-gateway.01-beauty-minimal.workers.dev</p></div>` +
        `<div style="display:flex; gap:16px; align-items:center">${label('회원 앱', GREEN)}<p style="font-family:${MONO}; font-size:28px; font-weight:600; color:${INK}">같은 주소 뒤에 /m/</p></div></div>`) +
      `<div style="display:flex; gap:20px; align-items:stretch">` +
        try3('본사', NAVY, ['대시보드', '마포점(갱신 임박) 운영 실적', '권한 관리']) +
        try3('지점 관리자', AMBER, ['회원', '회원 상세', '예약 관리 — 주간 시간표']) +
        try3('회원', GREEN, ['예약하기', '결제(모의)', '홈 혼잡도']) +
      `</div>` +
      ptxt('시연 데이터는 공용이라 바뀌어 있을 수 있습니다 · 실운영 서비스가 아닌 시연용', 25)));
}

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
    intro: { description: 'Ⅰ 들어가며 — 표지, 한 장 요약, 읽는 법', start: 'cover' },
    context: { description: 'Ⅱ 맥락 — 사업 구조, 만든 것, 맞물림 지도, 본사·지점·회원의 하루', start: 'p2' },
    design: { description: 'Ⅲ 설계 — 깨지면 안 되는 규칙 3개, 계약·파견 데이터, 세부 권한, 시스템 구성', start: 'p3' },
    rfp: { description: 'Ⅳ RFP 이행 현황 — 나눈 방법, 영역별 조항 수, 조항별 구현한 것(원문 순서)', start: 'p4' },
    verify: { description: 'Ⅴ 확인 — 자동 테스트, 운영 측정, 보안과 운영', start: 'p5' },
    progress: { description: 'Ⅵ 진행 경과 — 타임라인, 1~6주차 요약, 6주차 이후 작업', start: 'p6' },
    wrap: { description: 'Ⅶ 마무리 — 바꾼 것, 남은 것, 다음 계획, AI 협업, 직접 써 보기', start: 'p7' },
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
