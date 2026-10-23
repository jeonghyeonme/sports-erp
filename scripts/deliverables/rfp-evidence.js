// RFP 이행 증빙(HTML → PDF) — 앞에 72조항 한눈 표, 뒤에 조항별 "원문 → 이행 상태 → 구현한 것(쉬운 말 한 줄) → 결정 기록 → 화면".
//   npm run build --workspace=apps/api && npm run build:web
//   PW_CHROMIUM_PATH=... node scripts/deliverables/capture-rfp.mjs   (화면 먼저 — figs/rfp/<조항 ID>.png)
//   PW_CHROMIUM_PATH=... node scripts/deliverables/rfp-evidence.js
//     → scripts/deliverables/rfp-evidence.html(그림은 figs/rfp/를 상대 경로로 — 아티팩트로 올릴 때 함께 올린다)
//     → docs/deliverables/RFP이행증빙.pdf(같은 HTML을 Chromium으로 인쇄)
// 원천: 판정은 docs/reference/요구사항추적표.md §3(여기서 새로 판정하지 않는다), 한 줄 설명과 화면 연결은 rfp-plain.json(D67 —
// 기술 근거 대신 쉬운 말로 교체), 결정 제목은 docs/decisions/README.md 요약표와 docs/domains/*.md의 ADR 절 제목.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const TRACE = path.join(ROOT, 'docs/reference/요구사항추적표.md');
const PLAIN = JSON.parse(fs.readFileSync(path.join(__dirname, 'rfp-plain.json'), 'utf8'));
const HTML_OUT = path.join(__dirname, 'rfp-evidence.html');
const PDF_OUT = path.join(ROOT, 'docs/deliverables/RFP이행증빙.pdf');

// 판정 이름 — 추적표 §3의 판정을 바꾸지 않고 부르는 이름만 바꾼다(중간발표 4-7 "이행 상태 이름"과 같다)
const STATUS = { 구현: '완료', 조정: '조정', 부분: '부분', 미구현: '제외', '해당 없음': '해당 없음' };
const STATUS_KEY = { 완료: 'done', 조정: 'adj', 부분: 'part', 제외: 'out', '해당 없음': 'na' };
const STATUS_NOTE = {
  완료: 'RFP가 말한 것을 그대로 했다',
  조정: '결과는 냈고 방식을 바꿨다 — 바꾼 이유가 결정 기록에 있다',
  부분: '일부만 했다 — 남은 것은 실제 운영이 있어야 끝난다',
  제외: '의도적으로 하지 않았다 — 이유를 적었다',
  '해당 없음': '발주기관·계약·대면 행위처럼 이 프로젝트에 대상이 없다',
};
const AREAS = [
  { key: '### 3-1.', area: '기능·성능', page: 'RFP p.5 세부 과업 표' },
  { key: '### 3-2.', area: '시스템·데이터·인터페이스·보안·사업지원·제약', page: 'RFP p.6 세부 과업 표' },
  { key: '### 3-3.', area: '과업·산출물·개념도', page: 'RFP p.3~4 과업, p.7 산출물, p.4 개념도' },
];

function clauses() {
  const md = fs.readFileSync(TRACE, 'utf8');
  const out = [];
  for (const [i, s] of AREAS.entries()) {
    const start = md.indexOf(s.key);
    const end = i + 1 < AREAS.length ? md.indexOf(AREAS[i + 1].key) : md.indexOf('\n## ', start + 1);
    for (const line of md.slice(start, end).split('\n')) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.length !== 5 || cells[0] === 'ID' || cells[0].startsWith('---')) continue;
      const [id, rfp, text, verdict, basis] = cells;
      const plain = PLAIN[id];
      if (!plain) throw new Error(`rfp-plain.json에 없음: ${id}`);
      const page = s.area !== '과업·산출물·개념도' ? null : id.startsWith('P') ? 'p.7' : id.startsWith('C') ? 'p.4' : 'p.3~4';
      out.push({ id, rfp, text, status: STATUS[verdict] ?? verdict, basis, area: s.area, page, ...plain });
    }
  }
  const missing = Object.keys(PLAIN).filter((k) => k !== '_' && !out.some((c) => c.id === k));
  if (missing.length) throw new Error(`추적표에 없는 조항: ${missing.join(', ')}`);
  for (const c of out)
    for (const s of c.shots)
      if (!fs.existsSync(path.join(__dirname, 'figs/rfp', `${s}.png`))) throw new Error(`화면 없음: ${s}.png (${c.id})`);
  return out;
}

// 결정 제목 — 요약표·ADR 제목의 첫 구절만(" — " 앞), 코드 표기는 덜어 낸다
function decisionTitles() {
  const clean = (t) =>
    t
      .split(' — ')[0]
      .replace(/\s*\([^)]*(?:ADR-|@|`|log\/|\d{4}-\d{2})[^)]*\)/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .trim();
  const titles = new Map();
  const readme = fs.readFileSync(path.join(ROOT, 'docs/decisions/README.md'), 'utf8');
  for (const m of readme.matchAll(/^\| \[(D\d+)\]\(D\d+\.md\) \| ([^|]+) \|/gm)) titles.set(m[1], { title: clean(m[2]), where: '결정 기록' });
  const domains = path.join(ROOT, 'docs/domains');
  for (const f of fs.readdirSync(domains).filter((n) => n.endsWith('.md'))) {
    const doc = fs.readFileSync(path.join(domains, f), 'utf8');
    for (const m of doc.matchAll(/^### (ADR-[A-Z]+-\d+): (.+)$/gm)) titles.set(m[1], { title: clean(m[2]), where: f.replace('.md', '') });
  }
  return titles;
}

function decisionIds(basis) {
  const ids = new Set();
  basis = basis.replace(/\(?\bD\d+ 대체\)?/g, ''); // "D60(D1 대체)" — 대체된 옛 결정은 지금 이행의 근거가 아니다
  for (const m of basis.matchAll(/ADR-[A-Z]+-\d+/g)) ids.add(m[0]);
  for (const m of basis.matchAll(/\bD(\d+)(?:·D?(\d+))*/g))
    for (const n of m[0].replace(/^D/, '').split('·')) if (/^\d+$/.test(n)) ids.add(`D${n}`);
  return [...ids];
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pill = (status) => `<span class="pill ${STATUS_KEY[status]}">${esc(status)}</span>`;
const MOBILE = new Set(['F8-1', 'F6-1', 'T4-1', 'N8-2']); // 회원 앱 화면(휴대폰 크기)

const all = clauses();
const titles = decisionTitles();
const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const count = (list, s) => list.filter((c) => c.status === s).length;
const judged = all.filter((c) => c.status !== '해당 없음');
const met = count(all, '완료') + count(all, '조정');

const areaRows = AREAS.map(({ area }) => {
  const list = all.filter((c) => c.area === area);
  const j = list.filter((c) => c.status !== '해당 없음');
  const ok = count(list, '완료') + count(list, '조정');
  return `<tr><th scope="row">${esc(area)}</th><td>${list.length}</td>${['완료', '조정', '부분', '제외', '해당 없음'].map((s) => `<td>${count(list, s)}</td>`).join('')}<td class="rate">${ok}/${j.length}</td></tr>`;
}).join('');

const glance = AREAS.map(({ area, page }) => {
  const rows = all
    .filter((c) => c.area === area)
    .map(
      (c) => `<tr>
        <td class="id"><a href="#c-${c.id}">${c.id}</a></td>
        <td class="req"><span class="rfp">${esc(c.rfp)}</span>${esc(c.text)}</td>
        <td class="st">${pill(c.status)}</td>
        <td class="plain">${esc(c.plain)}</td>
      </tr>`,
    )
    .join('');
  return `<h3 class="area-h">${esc(area)} <small>${esc(page)}</small></h3>
  <div class="table-wrap"><table class="glance">
    <thead><tr><th>조항</th><th>RFP 요구(원문 요약)</th><th>상태</th><th>구현한 것</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}).join('');

const detail = AREAS.map(({ area, page }) => {
  const cards = all
    .filter((c) => c.area === area)
    .map((c) => {
      const ids = decisionIds(c.basis);
      const dec = ids.length
        ? `<ul class="dec">${ids
            .map((id) => {
              const t = titles.get(id);
              return `<li><b>${id}</b> ${t ? `${esc(t.title)} <span class="where">${esc(t.where)}</span>` : ''}</li>`;
            })
            .join('')}</ul>`
        : '<p class="none">별도 결정 없음 — RFP 그대로 이행했거나 대상이 없다</p>';
      const figs = c.shots
        .map(
          (s) => `<figure class="${MOBILE.has(s) ? 'phone' : 'desk'}">
          <a href="figs/rfp/${s}.png" target="_blank" rel="noopener"><img src="figs/rfp/${s}.png" alt="${esc(c.id)} 화면" loading="lazy"></a>
          <figcaption>화면 ${s}${s !== c.id ? ` (${esc(all.find((x) => x.id === s)?.text ?? '')} 화면을 함께 씀)` : ''}</figcaption>
        </figure>`,
        )
        .join('');
      return `<article class="clause${c.shots.length ? '' : ' short'}" id="c-${c.id}">
        <header>
          <span class="cid">${c.id}</span>
          <h4>${esc(c.text)}</h4>
          ${pill(c.status)}
        </header>
        <dl>
          <div><dt>RFP</dt><dd>${esc(c.rfp)}${c.page ? ` · ${c.page}` : ''}</dd></div>
          <div><dt>구현한 것</dt><dd class="plain">${esc(c.plain)}</dd></div>
          <div><dt>결정 기록</dt><dd>${dec}</dd></div>
        </dl>
        ${figs ? `<div class="figs">${figs}</div>` : ''}
      </article>`;
    })
    .join('');
  return `<section class="area"><h2 class="sec">${esc(area)} <small>${esc(page)}</small></h2>${cards}</section>`;
}).join('');

const html = `<title>RFP 이행 증빙</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;600;700&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* 관리자 웹과 같은 색(디자인시스템 D15) — 짙은 남색 머리, 청록 강조. 한 열 문서, 앞은 한눈 표, 뒤는 조항 카드 */
:root {
  --bg: #f8fafc; --surface: #ffffff; --surface-alt: #f1f5f9; --line: #e2e8f0; --line-strong: #cbd5e1;
  --ink: #0f172a; --muted: #64748b; --accent: #0f766e; --accent-soft: #f0fdfa; --head: #0f172a; --head-ink: #e2e8f0;
  --done: #0f766e; --done-bg: #ccfbf1; --adj: #1d4ed8; --adj-bg: #dbeafe; --part: #b45309; --part-bg: #fef3c7;
  --out: #b91c1c; --out-bg: #fee2e2; --na: #475569; --na-bg: #e2e8f0;
  --sans: 'IBM Plex Sans KR', 'Noto Sans KR', 'Noto Sans CJK KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0b1220; --surface: #111a2b; --surface-alt: #172238; --line: #23314a; --line-strong: #334563;
  --ink: #e2e8f0; --muted: #94a3b8; --accent: #2dd4bf; --accent-soft: #10302d; --head: #060b16; --head-ink: #e2e8f0;
  --done: #5eead4; --done-bg: #123a36; --adj: #93c5fd; --adj-bg: #1b2d4f; --part: #fcd34d; --part-bg: #3d3014;
  --out: #fca5a5; --out-bg: #431c1c; --na: #cbd5e1; --na-bg: #263248; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #0b1220; --surface: #111a2b; --surface-alt: #172238; --line: #23314a; --line-strong: #334563;
  --ink: #e2e8f0; --muted: #94a3b8; --accent: #2dd4bf; --accent-soft: #10302d; --head: #060b16; --head-ink: #e2e8f0;
  --done: #5eead4; --done-bg: #123a36; --adj: #93c5fd; --adj-bg: #1b2d4f; --part: #fcd34d; --part-bg: #3d3014;
  --out: #fca5a5; --out-bg: #431c1c; --na: #cbd5e1; --na-bg: #263248; color-scheme: dark }
* { box-sizing: border-box }
body { background: var(--bg); color: var(--ink); font: 15px/1.65 var(--sans); margin: 0 }
.wrap { max-width: 1080px; margin: 0 auto; padding-block: 0 64px;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)) }
.masthead { background: var(--head); color: var(--head-ink);
  padding-block: 40px 32px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)) }
.masthead .in { max-width: 1080px; margin: 0 auto; display: grid; gap: 10px }
.eyebrow { font: 500 12px/1 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: #5eead4 }
h1 { font-size: clamp(28px, 4vw, 40px); line-height: 1.2; margin: 0; text-wrap: balance }
.masthead p { margin: 0; max-width: 68ch; color: #cbd5e1 }
.meta { display: flex; flex-wrap: wrap; gap: 8px 24px; font-size: 13px; color: #94a3b8 }
.meta b { color: #e2e8f0; font-weight: 600 }
h2.sec { font-size: 22px; margin: 48px 0 12px; padding-bottom: 8px; border-bottom: 2px solid var(--ink); text-wrap: balance }
h2 small, h3 small { font-size: 13px; font-weight: 400; color: var(--muted); margin-left: 6px }
h3.area-h { font-size: 16px; margin: 28px 0 8px }
p.lead { max-width: 72ch; margin: 0 0 16px }
.summary { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: start }
@media (max-width: 760px) { .summary { grid-template-columns: minmax(0, 1fr) } }
.big { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap }
.big strong { font-size: 48px; line-height: 1; color: var(--accent); font-variant-numeric: tabular-nums }
.big span { color: var(--muted) }
.legend { display: grid; gap: 6px; margin: 16px 0 0; padding: 0; list-style: none; font-size: 14px }
.legend li { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 8px; align-items: baseline }
.table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--surface) }
table { border-collapse: collapse; width: 100%; font-size: 14px }
th, td { padding: 8px 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top }
thead th { background: var(--surface-alt); font-size: 12px; color: var(--muted); font-weight: 600; letter-spacing: .02em; white-space: nowrap }
tbody tr:last-child td, tbody tr:last-child th { border-bottom: 0 }
table.count td { text-align: right; font-variant-numeric: tabular-nums }
table.count th[scope=row] { font-weight: 600 }
table.count td.rate { font-weight: 700; color: var(--accent) }
table.count tfoot td, table.count tfoot th { border-top: 2px solid var(--line-strong); font-weight: 700 }
table.glance { min-width: 760px }
table.glance td.id { font: 500 13px var(--mono); white-space: nowrap }
table.glance td.id a { color: var(--accent); text-decoration: none }
table.glance td.req { width: 34% }
table.glance .rfp { display: block; font-size: 12px; color: var(--muted) }
table.glance td.st { white-space: nowrap }
.pill { display: inline-block; padding: 1px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap }
.pill.done { color: var(--done); background: var(--done-bg) } .pill.adj { color: var(--adj); background: var(--adj-bg) }
.pill.part { color: var(--part); background: var(--part-bg) } .pill.out { color: var(--out); background: var(--out-bg) }
.pill.na { color: var(--na); background: var(--na-bg) }
.note { border-left: 3px solid var(--accent); background: var(--accent-soft); padding: 10px 14px; margin: 16px 0; font-size: 14px }
.note p { margin: 0 } .note p + p { margin-top: 6px }
.clause { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 16px 18px; margin: 14px 0; scroll-margin-top: 16px }
.clause.short { padding-block: 12px }
.clause header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px }
.cid { font: 500 13px var(--mono); color: var(--accent) }
.clause h4 { margin: 0; font-size: 16px; flex: 1 1 320px; min-width: 0; text-wrap: balance }
.clause dl { margin: 10px 0 0; display: grid; gap: 6px }
.clause dl > div { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 12px }
@media (max-width: 520px) { .clause dl > div { grid-template-columns: minmax(0, 1fr); gap: 0 } }
.clause dt { font-size: 12px; color: var(--muted); padding-top: 2px; letter-spacing: .02em }
.clause dd { margin: 0; min-width: 0 }
.clause dd.plain { font-weight: 600 }
ul.dec { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; font-size: 14px }
ul.dec b { font: 500 13px var(--mono); margin-right: 4px }
.where { font-size: 12px; color: var(--muted) }
.where::before { content: '· ' }
p.none { margin: 0; font-size: 14px; color: var(--muted) }
.figs { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; align-items: flex-start }
figure { margin: 0; min-width: 0 }
figure.desk { flex: 1 1 100% }
figure.phone { flex: 0 1 260px }
figure img { display: block; width: 100%; height: auto; border: 1px solid var(--line-strong); border-radius: 4px; background: #fff }
figcaption { font-size: 12px; color: var(--muted); margin-top: 4px }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }
footer.end { margin-top: 48px; font-size: 13px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 12px }
@page { size: A4; margin: 14mm 12mm }
@media print {
  body { font-size: 11pt; background: #fff }
  .masthead { -webkit-print-color-adjust: exact; print-color-adjust: exact }
  .pill, thead th, .note { -webkit-print-color-adjust: exact; print-color-adjust: exact }
  .table-wrap { overflow: visible; border: 0 }
  table.glance { min-width: 0 }
  tr { break-inside: avoid }
  h2.sec { break-before: page; margin-top: 0 }
  .clause { break-inside: avoid; border-color: #cbd5e1 }
  figure.desk img { max-height: 125mm; width: auto; max-width: 100% }
  figure.phone { flex-basis: 52mm }
  .glance-part { break-before: page }
}
</style>

<header class="masthead"><div class="in">
  <span class="eyebrow">스포이즘 ERP · 중간 보고 증빙</span>
  <h1>RFP 이행 증빙</h1>
  <p>제안요청서의 요구 하나하나를 어떻게 이행했는지, 조항마다 원문과 구현한 것, 결정 기록, 실제 화면을 묶었다. 앞의 한눈 표로 전체를 보고, 궁금한 조항은 번호를 눌러 상세로 간다.</p>
  <div class="meta"><span>기준일 <b>${today}</b></span><span>판정 원천 <b>요구사항추적표 §3</b></span><span>조항 <b>${all.length}개</b></span><span>화면 <b>시연 데이터로 로컬 실행</b></span></div>
</div></header>

<main class="wrap">
  <h2 class="sec" style="break-before:auto">요약</h2>
  <div class="summary">
    <div>
      <div class="big"><strong>${met}/${judged.length}</strong><span>판정 대상 조항 중 완료·조정 (${Math.round((met / judged.length) * 100)}%)</span></div>
      <p class="lead">RFP 원문의 글머리(•) 하나를 한 조항으로 나눴다. 시스템 기능·성능 요구는 모두 완료 또는 근거 있는 조정이다. 남은 부분 조항은 실제 운영(실결제 호출·위탁계약 서명·검수)이 있어야 끝나는데, 이 프로젝트는 실운영을 하지 않는다.</p>
      <ul class="legend">${Object.entries(STATUS_NOTE)
        .map(([k, v]) => `<li>${pill(k)}<span>${esc(v)}</span></li>`)
        .join('')}</ul>
    </div>
    <div class="table-wrap"><table class="count">
      <thead><tr><th>영역</th><th>조항</th><th>완료</th><th>조정</th><th>부분</th><th>제외</th><th>해당 없음</th><th>완료+조정</th></tr></thead>
      <tbody>${areaRows}</tbody>
      <tfoot><tr><th scope="row">합계</th><td>${all.length}</td>${['완료', '조정', '부분', '제외', '해당 없음'].map((s) => `<td>${count(all, s)}</td>`).join('')}<td class="rate">${met}/${judged.length}</td></tr></tfoot>
    </table></div>
  </div>
  <div class="note">
    <p><b>증거 읽는 법</b> — 화면은 그 조항이 실제로 동작하는 모습(시연 데이터, 로컬 실행)이고, 결정 기록은 설계·조정의 이유를 남긴 문서다. D 번호는 저장소 <code>docs/decisions/</code>의 결정 기록, ADR 번호는 <code>docs/domains/</code> 도메인 문서의 결정 절이다.</p>
    <p>판정은 자기 평가다. 그래서 판정을 바꾸지 않은 원천 표(요구사항추적표 §3)에서 자동으로 만들고, 조항마다 확인할 수 있는 증거를 붙였다.</p>
  </div>

  <section class="glance-part">
    <h2 class="sec">한눈 표 — ${all.length}개 조항</h2>
    ${glance}
  </section>

  ${detail}

  <footer class="end">저장소의 요구사항추적표 §3과 rfp-plain.json에서 scripts/deliverables/rfp-evidence.js가 만들었다. 화면은 capture-rfp.mjs가 화면 테스트 전용 DB에 시연 데이터를 넣고 찍었다(배포 환경과 무관).</footer>
</main>
`;

fs.writeFileSync(HTML_OUT, html);
console.log('작성:', path.relative(ROOT, HTML_OUT), `(${all.length}조항, 화면 ${new Set(all.flatMap((c) => c.shots)).size}장)`);

// PDF — 아티팩트 게시 때 붙는 문서 머리(charset·viewport)를 같게 씌워 Chromium으로 인쇄한다
(async () => {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.log('playwright 없음 — PDF는 건너뜀');
    return;
  }
  const wrapped = path.join(__dirname, '.rfp-evidence.print.html');
  fs.writeFileSync(wrapped, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html.replaceAll(' loading="lazy"', '')}</body></html>`); // 인쇄는 한 번에 — 지연 로딩이면 화면 밖 그림이 끝내 안 뜬다
  // 글꼴(Google Fonts)을 받으려면 바깥 연결이 필요하다 — 프록시를 거치는 환경이면 Chromium에도 넘긴다
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM_PATH && { executablePath: process.env.PW_CHROMIUM_PATH }), proxy });
  const page = await browser.newPage();
  await page.emulateMedia({ colorScheme: 'light', media: 'print' });
  await page.goto(`file://${wrapped}`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => page.waitForLoadState('load'));
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  await page.pdf({
    path: PDF_OUT,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<div style="font-size:8px;color:#64748b;width:100%;padding:0 12mm;display:flex;justify-content:space-between"><span>RFP 이행 증빙 · 스포이즘 ERP</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
  });
  await browser.close();
  fs.unlinkSync(wrapped);
  console.log('작성:', path.relative(ROOT, PDF_OUT));
})();
