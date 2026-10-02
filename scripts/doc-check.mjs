#!/usr/bin/env node
// 문서 검사기 — 문서 구조가 다시 썩지 않게 하는 기계 신호(D38). CI와 pre-commit hook이 실행한다.
//   1) 상대 링크·`docs/...` 경로 언급이 실제 파일을 가리키는가
//   2) 폐기된 옛 문서 이름(`06문서`, `1-7문서`, `1.spec/` 등)이 다시 등장하지 않는가
//   3) 인용된 ADR ID가 도메인 문서에 정의돼 있는가
//   4) 진입 문서가 크기 상한을 지키는가(매 세션 읽히는 문서가 비대해지는 것을 막는다)
//   5) log/·decisions/ 파일이 인덱스(README)에 빠짐없이 올라 있는가
// 사용: node scripts/doc-check.mjs   (위반이 있으면 exit 1)
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// URL.pathname은 Windows에서 "/C:/..."가 되어 chdir이 실패한다 — fileURLToPath로 OS 경로를 만든다.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const files = execSync('git -c core.quotepath=off ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && existsSync(f));

// 검사에서 빼는 곳: 끝난 과정 기록(원문 보존), 이미 적용된 마이그레이션 SQL(체크섬), 다른 저장소에서 복사한 스킬, 자기완결형 제출본
const SKIP = [/^docs\/log\/archive\//, /^apps\/api\/prisma\/migrations\//, /^\.claude\/skills\//, /^docs\/deliverables\//, /node_modules\//, /package-lock\.json$/, /^scripts\/doc-check\.mjs$/];
const TEXT = /\.(md|ts|tsx|js|mjs|cjs|css|yml|yaml|json|prisma|sh|toml)$/;
const targets = files.filter((f) => TEXT.test(f) && !SKIP.some((r) => r.test(f)));

const LIMITS = { 'CLAUDE.md': 130, 'apps/api/CLAUDE.md': 80, 'apps/admin-web/CLAUDE.md': 60, 'docs/STATUS.md': 80 };
const CARD_LIMIT = 40;

const errors = [];
const err = (f, line, msg) => errors.push(`${f}${line ? `:${line}` : ''}  ${msg}`);
const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;

const LEGACY = [
  [/(?<![\d-])(0[0-8]|1-\d{1,2}|2-[1-4]|3-1)문서/g, '옛 문서 번호 인용 — 도메인명 + 부록 번호(예: `예약및결제 A-6`)나 새 경로로 쓸 것'],
  [/\b[1-5]\.(spec|decisions|design|presentation|deliverables)\//g, '옛 폴더 경로'],
  [/(?<![\d.-])(설계 )?1-(10|[1-9]) §/g, '옛 설계서 번호 + 절 — 도메인명 + 부록 번호나 architecture/entities.md §n으로 쓸 것'],
  [/06_진행_로그|2-1_기술결정사항|2-2_트러블슈팅|2-3_요구사항추적표|2-4_차별화전략|3-1_디자인시스템|1-1_공통설계서/g, '옛 파일명'],
];

const adrDefined = new Set();
for (const f of files.filter((x) => /^docs\/domains\/.+\.md$/.test(x))) {
  for (const m of readFileSync(f, 'utf8').matchAll(/^#{2,4} (ADR-[A-Z]+-\d+)/gm)) adrDefined.add(m[1]);
}

for (const f of targets) {
  const text = readFileSync(f, 'utf8');
  const dir = path.dirname(f);

  if (f.endsWith('.md')) {
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const t = m[1];
      if (/^(https?:|mailto:|#)/.test(t)) continue;
      const p = decodeURI(t.split('#')[0]);
      if (!p) continue;
      if (!existsSync(path.join(dir, p))) err(f, lineOf(text, m.index), `끊긴 링크: ${t}`);
    }
  }
  // 과거 기록(log/·decisions/)은 당시 경로를 서술한 문장이 많아 링크만 검사한다
  if (!/^docs\/(log|decisions)\//.test(f)) {
    for (const m of text.matchAll(/(?<![\w/.-])docs\/[^\s)`'"*,|<>[\]()·]+/g)) {
      const p = m[0].replace(/[가-힣]+$/, '').replace(/[.:;·]+$/, '').replace(/(\.md)[^/]*$/, '$1');
      if (/[{}*]|NNN|<|\.\.\./.test(p)) continue;
      const base = p.replace(/~\d+$/, '');
      const prefixHit = files.some((x) => x.startsWith(base));
      if (!existsSync(base) && !existsSync(base + '.md') && !prefixHit) err(f, lineOf(text, m.index), `없는 경로 언급: ${p}`);
    }
  }
  if (!/^docs\/(log|decisions)\//.test(f)) {
    for (const [re, msg] of LEGACY) {
      for (const m of text.matchAll(re)) err(f, lineOf(text, m.index), `${msg}: ${m[0]}`);
    }
  }
  for (const m of text.matchAll(/\bADR-([A-Z]+)-(\d+)\b/g)) {
    if (!adrDefined.has(m[0])) err(f, lineOf(text, m.index), `정의되지 않은 ADR: ${m[0]}`);
  }
}

for (const [f, max] of Object.entries(LIMITS)) {
  if (!existsSync(f)) { err(f, 0, '진입 문서가 없다'); continue; }
  const n = readFileSync(f, 'utf8').split('\n').length;
  if (n > max) err(f, 0, `크기 상한 초과: ${n}줄 > ${max}줄 — 이력은 log/·decisions/로 옮길 것`);
}
for (const f of files.filter((x) => /^docs\/domains\/.+\.md$/.test(x))) {
  const text = readFileSync(f, 'utf8');
  const m = text.match(/^## 요약 카드\n([\s\S]*?)(?=^## )/m);
  if (!m) err(f, 0, '요약 카드(## 요약 카드)가 없다');
  else if (m[1].split('\n').length > CARD_LIMIT) err(f, 0, `요약 카드 ${m[1].split('\n').length}줄 > ${CARD_LIMIT}줄`);
}

for (const [dir, re] of [['docs/log', /^\d{3}\.md$/], ['docs/decisions', /^D\d+\.md$/]]) {
  const index = existsSync(`${dir}/README.md`) ? readFileSync(`${dir}/README.md`, 'utf8') : '';
  for (const f of files.filter((x) => path.dirname(x) === dir && re.test(path.basename(x)))) {
    if (!index.includes(`(${path.basename(f)})`)) err(`${dir}/README.md`, 0, `인덱스에 없는 파일: ${path.basename(f)}`);
  }
}

if (errors.length) {
  console.error(`[doc-check] 위반 ${errors.length}건\n` + errors.join('\n'));
  process.exit(1);
}
console.log(`[doc-check] 통과 (${targets.length}개 파일)`);
