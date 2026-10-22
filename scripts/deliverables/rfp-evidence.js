// RFP 이행 증빙서 — 조항마다 "RFP 원문 → 판정 → 구현한 것 → 화면 증거 → 결정 기록"을 한 묶음으로 보인다.
//   PW_CHROMIUM_PATH=... node scripts/deliverables/capture-rfp.mjs   (화면 증거 먼저 — figs/rfp/<조항 ID>.png)
//   node scripts/deliverables/rfp-evidence.js [--only F1,F2] [--out <폴더>]
//     → <폴더>/RFP이행증빙.docx (+ .pdf — soffice가 있으면). 기본 폴더는 docs/deliverables
// 원천은 저장소다 — 판정·구현 근거는 docs/reference/요구사항추적표.md §3(단일 원천, 여기서 새로 판정하지 않는다),
// 결정 제목은 docs/decisions/README.md 요약표와 docs/domains/*.md의 ADR 절 제목.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { p, h1, h2, h3, callout, table, figure, cover, build, gap } = require('./docx_common');

const ROOT = path.join(__dirname, '..', '..');
const TRACE = path.join(ROOT, 'docs/reference/요구사항추적표.md');
const args = process.argv.slice(2);
const argOf = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const ONLY = argOf('--only')?.split(',');
const OUT_DIR = argOf('--out') ?? path.join(ROOT, 'docs/deliverables');

// 판정 이름 — 추적표 §3의 판정을 바꾸지 않고 부르는 이름만 바꾼다(중간발표 4-7 "이행 상태 이름"과 같다)
const STATUS = { 구현: '완료', 조정: '조정', 부분: '부분', 미구현: '제외', '해당 없음': '해당 없음' };
const STATUS_NOTE = {
  완료: 'RFP가 말한 것을 그대로 했다',
  조정: '결과는 냈고 방식을 바꿨다 — 바꾼 이유가 결정 기록에 있다',
  부분: '일부만 했다 — 남은 것을 적었다',
  제외: '의도적으로 하지 않았다 — 이유를 적었다',
  '해당 없음': '발주기관·계약·대면 행위처럼 이 프로젝트에 대상이 없다',
};

// ── 추적표 §3 조항 표 읽기 ──
function clauses() {
  const md = fs.readFileSync(TRACE, 'utf8');
  const sections = [
    { key: '### 3-1.', area: '기능·성능', page: 'p.5' },
    { key: '### 3-2.', area: '시스템·데이터·인터페이스·보안·사업지원·제약', page: 'p.6' },
    { key: '### 3-3.', area: '과업·산출물·개념도', page: null },
  ];
  const out = [];
  for (const [i, s] of sections.entries()) {
    const start = md.indexOf(s.key);
    const end = i + 1 < sections.length ? md.indexOf(sections[i + 1].key) : md.indexOf('\n## ', start + 1);
    for (const line of md.slice(start, end).split('\n')) {
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.length !== 5 || cells[0] === 'ID' || cells[0].startsWith('---')) continue;
      const [id, rfp, text, verdict, basis] = cells;
      const page = s.page ?? (id.startsWith('P') ? 'p.7' : id.startsWith('C') ? 'p.4' : 'p.3~4');
      out.push({ id, rfp, text, status: STATUS[verdict] ?? verdict, basis, area: s.area, page });
    }
  }
  return out;
}

// ── 결정 기록 제목 ──
function decisionTitles() {
  const titles = new Map();
  const readme = fs.readFileSync(path.join(ROOT, 'docs/decisions/README.md'), 'utf8');
  for (const m of readme.matchAll(/^\| \[(D\d+)\]\(D\d+\.md\) \| ([^|]+) \|/gm)) titles.set(m[1], m[2].trim());
  const domains = path.join(ROOT, 'docs/domains');
  for (const f of fs.readdirSync(domains).filter((n) => n.endsWith('.md'))) {
    const doc = fs.readFileSync(path.join(domains, f), 'utf8');
    for (const m of doc.matchAll(/^### (ADR-[A-Z]+-\d+): (.+)$/gm)) {
      titles.set(m[1], `${m[2].replace(/\s*\(\d{4}-\d{2}-\d{2}[^)]*\)\s*$/, '').trim()} — ${f.replace('.md', '')}`);
    }
  }
  return titles;
}

// 근거 칸에서 결정 ID를 뽑고, 읽는 사람에게 뜻이 없는 내부 표기(진행 기록 번호·테스트 파일명)를 덜어 낸다.
function decisionIds(basis) {
  const ids = new Set();
  // "D60(D1 대체)"처럼 대체된 옛 결정은 지금 이행의 근거가 아니므로 뺀다
  basis = basis.replace(/\(?\bD\d+ 대체\)?/g, '');
  for (const m of basis.matchAll(/ADR-[A-Z]+-\d+/g)) ids.add(m[0]);
  for (const m of basis.matchAll(/\bD(\d+)(?:·D?(\d+))*/g)) {
    for (const n of m[0].replace(/^D/, '').split('·')) if (/^\d+$/.test(n)) ids.add(`D${n}`);
  }
  return [...ids];
}
function readable(basis) {
  return basis
    .replace(/\s*—\s*`[^`]+`(?:·`[^`]+`)*/g, '') // " — `spec`" 테스트 파일명
    .replace(/`([^`]+)`/g, '$1')
    .replace(/,?\s*log\/\d+(?:[~·]\d+)*/g, '')
    .replace(/\(\s*[,·]?\s*\)/g, '')
    .replace(/\s+\)/g, ')')
    .replace(/\(\s*,\s*/g, '(')
    .trim();
}

const figPath = (id) => path.join(__dirname, 'figs', 'rfp', `${id}.png`);

function clauseBlock(c, titles) {
  const ids = decisionIds(c.basis);
  const decisions = ids.length
    ? ids.map((id) => `${id} ${titles.get(id) ?? ''}`.trim()).join('\n')
    : '—';
  const blocks = [
    h3(`${c.id}  ${c.text}`),
    table(
      ['항목', '내용'],
      [
        ['RFP 원문', `${c.rfp} · RFP ${c.page}\n"${c.text}"`],
        ['이행 상태', `**${c.status}** — ${STATUS_NOTE[c.status] ?? ''}`],
        ['구현한 것', readable(c.basis)],
        ['결정 기록', decisions],
        ['화면 증거', fs.existsSync(figPath(c.id)) ? `아래 그림 ${c.id}` : '화면이 아니라 문서·설계로 이행한 조항 — 결정 기록과 부록 문서'],
      ],
      [1, 5],
    ),
  ];
  if (fs.existsSync(figPath(c.id))) blocks.push(...figure(`rfp/${c.id}`, `그림 ${c.id} — ${c.text}`, 0.95));
  else blocks.push(gap());
  return blocks;
}

const all = clauses();
const shown = ONLY ? all.filter((c) => ONLY.some((pre) => c.id.startsWith(pre + '-') || c.id === pre)) : all;
const titles = decisionTitles();
const count = (list, s) => list.filter((c) => c.status === s).length;

const summaryRows = ['기능·성능', '시스템·데이터·인터페이스·보안·사업지원·제약', '과업·산출물·개념도'].map((area) => {
  const list = all.filter((c) => c.area === area);
  return [area, list.length, count(list, '완료'), count(list, '조정'), count(list, '부분'), count(list, '제외'), count(list, '해당 없음')];
});
summaryRows.push(['합계', all.length, count(all, '완료'), count(all, '조정'), count(all, '부분'), count(all, '제외'), count(all, '해당 없음')]);

const children = [
  ...cover('RFP 이행 증빙', '조항마다 원문 → 구현 → 화면 → 결정 기록', [
    ['기준', `${new Date().toISOString().slice(0, 10)} 저장소(dev 브랜치)에서 자동 생성 — 판정 원천은 요구사항추적표 §3`],
    ['범위', ONLY ? `${ONLY.join('·')} 조항(견본)` : `RFP 원문 글머리 72조항 전체`],
    ['읽는 법', '맨 앞 요약에서 영역별 조항 수를 보고, 궁금한 조항을 골라 그 조항의 화면과 결정 기록을 따라가면 된다'],
  ], { toc: false }),
  h1('요약 — 72조항을 이렇게 이행했다'),
  p('RFP 원문의 글머리(•) 하나를 한 조항으로 나눴다(기능·성능 p.5, 시스템~제약 p.6, 과업 p.3~4, 산출물 p.7, 개념도 p.4). 판정은 자기 평가이므로, 조항마다 확인할 수 있는 증거(화면 캡처와 결정 기록)를 함께 붙였다.'),
  table(['영역', '조항', '완료', '조정', '부분', '제외', '해당 없음'], summaryRows, [4, 1, 1, 1, 1, 1, 1.4]),
  gap(),
  table(['이행 상태', '뜻'], Object.entries(STATUS_NOTE).map(([k, v]) => [k, v]), [1, 5]),
  gap(),
  callout('증거의 종류', [
    '**화면** — 그 조항이 실제로 동작하는 화면 캡처(로컬 실행, 시연 데이터). 조항 ID로 이름을 붙였다.',
    '**결정 기록** — 설계·조정의 이유를 남긴 기록(D 번호는 결정 기록, ADR 번호는 도메인 문서의 결정 절). 조정·제외 조항은 이 기록이 "왜"를 설명한다.',
  ]),
];
let area = null;
for (const c of shown) {
  if (c.area !== area) {
    area = c.area;
    children.push(h1(`${area} (RFP ${c.page.startsWith('p.3') || c.page === 'p.7' || c.page === 'p.4' ? 'p.2~7' : c.page})`));
  }
  children.push(...clauseBlock(c, titles));
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const docx = path.join(OUT_DIR, 'RFP이행증빙.docx');
build(docx, 'RFP 이행 증빙', children).then(() => {
  try {
    execSync(`soffice --headless --convert-to pdf --outdir "${OUT_DIR}" "${docx}"`, { stdio: 'ignore' });
    console.log('RFP이행증빙.pdf 생성');
  } catch {
    console.log('soffice 없음 — PDF는 Word에서 저장');
  }
});
