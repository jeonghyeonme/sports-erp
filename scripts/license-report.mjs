#!/usr/bin/env node
// 운영 의존성 라이선스 목록 — RFP 규정의준수(1-2 #10, 요구사항추적표 N10-1·N10-2), log/139.
//
//   node scripts/license-report.mjs           → docs/architecture/dependency-licenses.md 를 다시 쓴다
//   node scripts/license-report.mjs --check   → 허용 목록 밖 라이선스가 있으면 종료 코드 1(파일은 안 씀)
//
// 대상은 `npm query ".prod"`(개발 의존성 제외, 워크스페이스 자신 제외)다. 라이선스는 package.json의
// `license` → 옛 형식 `licenses[].type` → LICENSE 파일 첫머리 순으로 읽는다. 셋 다 없으면 "확인 필요".
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'docs/architecture/dependency-licenses.md');

// 상업적 사용·수정·배포에 고지 외 의무가 없는 허용형 라이선스만 둔다. 이 밖은 검토 대상이다.
const PERMISSIVE = new Set(['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'BlueOak-1.0.0', 'Unlicense', 'CC0-1.0']);

function licenseFromFile(dir) {
  // LICENSE 파일이 없으면 README의 License 절을 읽는다(옛 패키지 — 예: pause는 Readme.md에 MIT 전문만 있다).
  const files = existsSync(dir) ? readdirSync(dir) : [];
  const file = files.find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  const readme = files.find((f) => /^readme(\.|$)/i.test(f));
  let head;
  if (file) head = readFileSync(join(dir, file), 'utf8').slice(0, 600);
  else if (readme) head = readFileSync(join(dir, readme), 'utf8').split(/^#+\s*licen[cs]e\s*$/im)[1]?.slice(0, 800);
  if (!head) return null;
  if (/Permission is hereby granted, free of charge/i.test(head)) return 'MIT';
  if (/Permission to use, copy, modify, and\/or distribute/i.test(head)) return 'ISC';
  if (/Apache License/i.test(head)) return 'Apache-2.0';
  return null;
}

function licenseOf(pkg) {
  const dir = join(ROOT, pkg.location);
  if (typeof pkg.license === 'string') return { license: pkg.license, source: 'package.json' };
  const json = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const legacy = Array.isArray(json.licenses) ? json.licenses.map((l) => l.type ?? l).join(' OR ') : json.license?.type;
  if (legacy) return { license: legacy, source: 'package.json(licenses)' };
  const fromFile = licenseFromFile(dir);
  if (fromFile) return { license: fromFile, source: 'LICENSE·README 본문' };
  return { license: '확인 필요', source: '-' };
}

// "(MIT OR Apache-2.0)"처럼 고를 수 있는 식은 허용형이 하나라도 있으면 허용, AND는 모두 허용형이어야 허용.
function isPermissive(expr) {
  const e = expr.replace(/[()]/g, '').trim();
  if (/ OR /.test(e)) return e.split(/ OR /).some((x) => PERMISSIVE.has(x.trim()));
  return e.split(/ AND /).every((x) => PERMISSIVE.has(x.trim()));
}

const raw = JSON.parse(execFileSync('npm', ['query', '.prod'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
const seen = new Map();
for (const p of raw) {
  if (!p.location || !p.location.startsWith('node_modules') || !p.name) continue; // 워크스페이스 자신 제외
  const key = `${p.name}@${p.version}`;
  if (seen.has(key)) continue;
  seen.set(key, { name: p.name, version: p.version, ...licenseOf(p) });
}
const rows = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
const review = rows.filter((r) => !isPermissive(r.license));

if (process.argv.includes('--check')) {
  if (review.length) {
    console.error(`허용 목록 밖 라이선스 ${review.length}건:`);
    for (const r of review) console.error(`  ${r.name}@${r.version} — ${r.license}`);
    process.exit(1);
  }
  console.log(`라이선스 점검 통과 — 운영 의존성 ${rows.length}개 모두 허용형`);
  process.exit(0);
}

const counts = new Map();
for (const r of rows) counts.set(r.license, (counts.get(r.license) ?? 0) + 1);
const lines = [
  '# 운영 의존성 라이선스 목록',
  '',
  `> \`node scripts/license-report.mjs\`가 만든 파일이다 — 손으로 고치지 않는다. 의존성을 바꾸면 다시 실행한다(\`--check\`는 허용형 밖이 있으면 실패).`,
  '> RFP 규정의준수(1-2 #10) 대응. 판정 기준과 경위는 [요구사항추적표](../reference/요구사항추적표.md) §3-2 N10, log/139.',
  '',
  '## 요약',
  '',
  `- 대상: 운영 의존성(\`npm query ".prod"\` — 개발·빌드 도구 제외) **${rows.length}개**. 관리자 웹·회원 웹 번들과 api(Lambda) 묶음에 들어가는 것이다.`,
  `- 허용형 라이선스(${[...PERMISSIVE].join(', ')}) 밖: **${review.length}건**${review.length ? ' — 아래 "검토 대상" 참고' : ''}.`,
  '- GPL·AGPL·LGPL 같은 상호주의(copyleft) 라이선스는 없다. 허용형 라이선스의 의무는 저작권·라이선스 고지 유지뿐이고, 배포 묶음(node_modules·번들)에 각 패키지의 LICENSE가 그대로 들어간다.',
  '- 프로젝트 자체 코드·문서·이미지는 직접 작성했다(외부 이미지·폰트·아이콘 파일을 저장소에 넣지 않았다 — 회원 웹 아이콘은 자체 제작, 글꼴은 시스템 글꼴).',
  '',
  '| 라이선스 | 개수 |',
  '|---|---|',
  ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([l, n]) => `| ${l} | ${n} |`),
  '',
];
if (review.length) {
  lines.push('## 검토 대상', '', '| 패키지 | 버전 | 라이선스 |', '|---|---|---|', ...review.map((r) => `| ${r.name} | ${r.version} | ${r.license} |`), '');
}
lines.push(
  '## 전체 목록',
  '',
  '라이선스를 package.json `license`가 아닌 곳에서 읽은 것은 "출처"에 적는다.',
  '',
  '| 패키지 | 버전 | 라이선스 | 출처 |',
  '|---|---|---|---|',
  ...rows.map((r) => `| ${r.name} | ${r.version} | ${r.license} | ${r.source === 'package.json' ? '' : r.source} |`),
  '',
);
writeFileSync(OUT, lines.join('\n'));
console.log(`${OUT.replace(ROOT, '')} — ${rows.length}개, 검토 대상 ${review.length}건`);
