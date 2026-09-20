// PreToolUse(Bash) hook: `git commit` 직전에 apps/·packages/ 변경이 있으면 빌드(타입체크)와 jest를 실행한다.
// 실패하면 exit 2로 커밋을 차단한다. 문서만 바뀐 커밋은 검사하지 않는다.
// hook 자체의 오류(파싱 실패 등)는 통과시킨다(fail-open).
// 테스트용: GUARD_FORCE_CHECK=1 이면 변경 파일과 무관하게 검사를 실행한다.
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const sh = (cmd) => spawnSync(cmd, { cwd: root, shell: true, encoding: 'utf8' });

const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  let cmd = '';
  try {
    cmd = JSON.parse(Buffer.concat(chunks).toString())?.tool_input?.command ?? '';
  } catch {
    process.exit(0);
  }
  if (!/\bgit\s+commit\b/.test(cmd) || /--dry-run/.test(cmd)) process.exit(0);

  // 같은 명령 안에서 git add 하거나 -a/--all 이면, hook 시점의 스테이징 상태가 실제 커밋과 다르므로
  // 작업 트리 전체 변경을 기준으로 삼는다.
  const broad = /\bgit\s+add\b/.test(cmd) || /\bgit\s+commit\b[^&|;]*(\s-\w*a\w*\b|--all\b)/.test(cmd);
  const listCmd = broad ? 'git status --porcelain' : 'git diff --cached --name-status';
  const out = sh(listCmd).stdout ?? '';
  const touchesCode = /(^|\s|")(apps|packages)\//.test(out);
  if (!touchesCode && process.env.GUARD_FORCE_CHECK !== '1') process.exit(0);

  // lint는 --fix 없이 실행한다(package.json의 lint 스크립트는 --fix라서 파일을 수정하므로 쓰지 않음).
  // warning은 통과, error만 차단한다.
  const checks = [
    ['api lint', 'npm exec --workspace=apps/api -- eslint .'],
    ['admin-web lint', 'npm exec --workspace=apps/admin-web -- eslint .'],
    ['api 빌드', 'npm run build --workspace=apps/api'],
    ['admin-web 빌드', 'npm run build --workspace=apps/admin-web'],
    ['api 테스트', 'npm test --workspace=apps/api -- --passWithNoTests'],
  ];
  for (const [name, c] of checks) {
    const r = sh(c);
    if (r.status !== 0) {
      const tail = `${r.stdout ?? ''}${r.stderr ?? ''}`.slice(-1500);
      console.error(`[pre-commit-check] ${name} 실패: 커밋을 차단합니다.\n${tail}`);
      process.exit(2);
    }
  }
  process.exit(0);
});
