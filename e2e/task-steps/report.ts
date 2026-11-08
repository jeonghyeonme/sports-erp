import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../env';
import { RESULT_FILE } from './recorder';

// results.json → results.md(역할·작업별 표). 단계 = 누름 + 입력.
export default function report() {
  const dir = join(ROOT, 'e2e/task-steps/out');
  const file = join(dir, RESULT_FILE);
  if (!existsSync(file)) return;
  type Row = { id: string; role: string; title: string; clicks: number; fields: number; total: number; screens: number; scrolls: number; steps: string[] };
  const rows = Object.values(JSON.parse(readFileSync(file, 'utf8')) as Record<string, Row>).sort((a, b) => a.id.localeCompare(b.id));
  const lines = [
    '| ID | 역할 | 작업 | 단계(누름+입력) | 누름 | 입력 | 화면 | 스크롤 |',
    '|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.id} | ${r.role} | ${r.title} | **${r.total}** | ${r.clicks} | ${r.fields} | ${r.screens} | ${r.scrolls} |`),
    '',
    ...rows.map((r) => `- ${r.id} ${r.title}: ${r.steps.join(' · ')}`),
  ];
  writeFileSync(join(dir, RESULT_FILE.replace('.json', '.md')), lines.join('\n') + '\n');
}
