// 사용자 매뉴얼(Word)과 역할별 빠른 시작(교육 자료, PDF) — RFP 과업4 "이용자 매뉴얼 제작·탑재"·산출물5 "어플 사용 교육 자료"(log/152).
//   PW_CHROMIUM_PATH=... node scripts/deliverables/capture-manual.mjs   (화면 캡처, 화면이 바뀌었을 때만)
//   node scripts/deliverables/manual.js   → docs/deliverables/사용자매뉴얼.docx, 교육자료_빠른시작.docx(.pdf — soffice가 있으면)
// 원천: 관리자 웹 화면 도움말(apps/admin-web/src/lib/help-content.ts)·오류 해결 문구(error-hints.ts)를 그대로 읽는다 —
// 화면이 바뀌면 도움말을 고치고 이걸 다시 돌린다(한 사실은 한 곳에만, D38). 회원 웹 장은 회원 웹 "이용 안내"(GuidePage.tsx)와 같은 내용이다.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ts = require('typescript');
const docx = require('./docx_common');
const { p, h1, h2, h3, bullets, callout, table, figure, cover, build } = docx;
// 목록마다 번호를 1부터 — 같은 정의('nums')에 목록마다 다른 instance를 준다.
let listNo = 0;
const numbered = (items) => docx.numbered(items, 'nums', ++listNo);

const ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'docs/deliverables');
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

// TS 원천을 그대로 읽는다(타입만 import하므로 변환 후 바로 실행된다). HELP_ROUTES는 내보내지 않는 상수라 끝에 붙여 꺼낸다.
function loadTs(rel, extra = '') {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8') + extra;
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', js)(mod, mod.exports, () => ({}));
  return mod.exports;
}
const { HELP_ROUTES } = loadTs('apps/admin-web/src/lib/help-content.ts', '\nexport { HELP_ROUTES };\n');
const { ERROR_HINTS } = loadTs('apps/admin-web/src/lib/error-hints.ts');
const helpOf = (route) => {
  const found = HELP_ROUTES.find((r) => r.path === route);
  if (!found) throw new Error(`도움말 없음: ${route}`);
  return found.help;
};

const ROLE_LABEL = { SUPER_ADMIN: '본사 관리자', BRANCH_ADMIN: '지점 관리자', STAFF: '지점 직원' };
// 역할별 메뉴 순서(관리자 웹 AppLayout NAV_BY_ROLE와 같게)와 그 화면의 캡처(capture-manual.mjs)
const ROLE_SCREENS = {
  SUPER_ADMIN: [
    ['/', 'hq-dashboard'], ['/branches/:branchId', 'hq-branch'], ['/staff', 'hq-staff'], ['/staff/:id'], ['/attendance'],
    ['/permissions', 'hq-permissions'], ['/audit-logs', 'hq-audit'], ['/members'], ['/programs'], ['/instructors'],
    ['/board'], ['/facilities'], ['/assets'], ['/documents'], ['/support-requests', 'hq-support'],
  ],
  BRANCH_ADMIN: [
    ['/', 'ba-dashboard'], ['/members', 'ba-members'], ['/members/:id', 'ba-member-detail'], ['/programs', 'ba-programs'],
    ['/instructors'], ['/reservations', 'ba-reservations'], ['/staff'], ['/staff/:id'], ['/attendance', 'ba-attendance'],
    ['/board', 'ba-board'], ['/board/:id'], ['/facilities', 'ba-facilities'], ['/assets'], ['/documents'], ['/support-requests'],
  ],
  STAFF: [['/', 'st-dashboard'], ['/staff'], ['/attendance', 'st-attendance'], ['/programs'], ['/board'], ['/facilities']],
};

function stepsFor(help, role) {
  const own = help.byRole?.[role];
  return [...(own ?? []), ...(help.common ?? [])];
}

function screenSection(role, route, shot, n) {
  const help = helpOf(route);
  const steps = stepsFor(help, role);
  if (steps.length === 0) return [];
  const out = [h3(`${n}. ${help.title}`), p(help.summary), ...numbered(steps)];
  if (shot) out.push(...figure(`manual/${shot}`, `${ROLE_LABEL[role]} — ${help.title}`, 0.95));
  const errs = help.errors.filter((c) => ERROR_HINTS[c]);
  if (errs.length) {
    out.push(p('**이런 문구가 뜨면**'));
    out.push(...bullets(errs.map((c) => `${c} — ${ERROR_HINTS[c]}`)));
  }
  return out;
}

function roleChapter(no, role) {
  let n = 0;
  return [
    h1(`${no}. ${ROLE_LABEL[role]}`),
    ...ROLE_SCREENS[role].flatMap(([route, shot]) => {
      const sec = screenSection(role, route, shot, n + 1);
      if (sec.length) n += 1;
      return sec;
    }),
  ];
}

// ── 사용자 매뉴얼 ─────────────────────────────────────────────────────
const manual = [
  ...cover('사용자 매뉴얼', '관리자 웹(본사·지점 관리자·직원)과 회원 앱', [
    ['과업', '제안요청서 과업4 "이용자 매뉴얼 제작·탑재"'],
    ['작성일', TODAY],
    ['원천', '관리자 웹 화면별 도움말(오른쪽 위 "? 도움말")·회원 앱 "이용 안내" — 화면과 같은 문구다'],
    ['구성', '1. 시작하기 · 2. 본사 관리자 · 3. 지점 관리자 · 4. 지점 직원 · 5. 회원 앱 · 부록 오류 해결'],
    ['함께 보는 문서', '교육 자료(역할별 빠른 시작, PDF)'],
  ]),
  h1('1. 시작하기'),
  h2('1.1 누가 무엇을 쓰나'),
  table(['사용자', '쓰는 화면', '할 수 있는 일'], [
    ['본사 관리자', '관리자 웹', '전 지점 현황·계약 상태, 직원 채용·파견·역할·세부 권한, 업무지원 요청 처리, 변경 이력'],
    ['지점 관리자', '관리자 웹', '자기 지점의 회원·프로그램·회차·예약, 직원 일상 관리(근태·휴가 승인), 게시판·시설·자산·문서'],
    ['지점 직원', '관리자 웹', '본인 출퇴근·휴가·업무일지, 지점 정보 조회'],
    ['회원', '회원 앱(휴대폰 웹)', '프로그램 예약·결제·취소, 혼잡도·공지 확인, 내 정보'],
  ], [2, 2, 6]),
  h2('1.2 화면 구성'),
  ...bullets([
    '**왼쪽 메뉴** — 역할마다 보이는 메뉴가 다르다. 본사가 세부 권한을 끄면 그 메뉴·버튼이 사라진다(D60).',
    '**처리 대기** — 대시보드 맨 위 카드와 메뉴 옆 숫자, 오른쪽 위 "처리 대기 N"이 지금 처리할 일의 건수다. 누르면 처리 화면으로 간다.',
    '**? 도움말** — 오른쪽 위 버튼을 누르면 지금 화면의 사용법이 오른쪽에 열린다. 이 매뉴얼의 각 절과 같은 내용이다.',
    '**오류가 나면** — 빨간 안내 아래 "해결:" 줄에 할 일이 적혀 있다(부록 오류 해결과 같다).',
  ]),
  ...figure('manual/ba-help', '화면 도움말 — 오른쪽 위 "? 도움말"을 누르면 열린다', 0.95),
  h2('1.3 로그인'),
  ...numbered([
    '관리자 웹 주소로 들어가 이메일·비밀번호를 넣는다. 처음 계정은 본사가 채용할 때 만든다.',
    '비밀번호는 오른쪽 위 "비밀번호 변경"에서 바꾼다. 바꾸면 다른 기기의 로그인도 끊긴다.',
    '퇴사 처리된 계정은 그 순간부터 들어갈 수 없다.',
  ]),
  ...roleChapter(2, 'SUPER_ADMIN'),
  ...roleChapter(3, 'BRANCH_ADMIN'),
  ...roleChapter(4, 'STAFF'),
  h1('5. 회원 앱'),
  p('휴대폰 브라우저로 회원 앱 주소(관리자 웹 주소 뒤 /m/)에 들어간다. 앱 안 "이용 안내"와 같은 내용이다.'),
  h3('1. 처음 시작하기'),
  ...numbered([
    '지점에서 이미 회원 등록을 했다면 "처음 오셨나요? → 지점에서 이미 회원 등록을 했어요"에서 회원번호와 전화번호로 계정을 연결한다.',
    '아직 등록하지 않았다면 "아직 등록하지 않았어요"에서 다닐 지점을 고르고 가입한다.',
    '홈 화면에 앱 아이콘을 추가하면 주소창 없이 바로 열 수 있다.',
  ]),
  ...figure('manual/m-home', '회원 앱 — 홈(혼잡도·공지)', 0.38),
  h3('2. 예약하고 결제하기'),
  ...numbered([
    '하단 "예약하기"에서 프로그램을 고르고 회차를 누른 뒤 "예약하기"(유료는 "예약하고 결제하기")를 누른다.',
    '유료 회차는 결제해야 예약이 확정된다.',
    '"내 예약"에서 예약을 보고 취소한다. 수업 시작 기준 시간 전에 취소하면 전액 환불된다.',
  ]),
  ...figure('manual/m-programs', '회원 앱 — 예약하기', 0.38),
  ...figure('manual/m-reservations', '회원 앱 — 내 예약', 0.38),
  h3('3. 공지와 내 정보'),
  ...bullets([
    '"공지"에서 지점·본사 공지를 보고, 시설을 골라 그 시설 공지만 볼 수 있다. 이미지 첨부는 본문 아래에 바로 보인다.',
    '"내 정보"에서 이름·연락처를 고치고 수강 내역·PT 남은 횟수를 본다.',
  ]),
  ...figure('manual/m-notices', '회원 앱 — 공지(시설 고르기)', 0.38),
  h1('부록. 오류 해결'),
  p('화면에 뜨는 오류의 해결 방법이다. 관리자 웹은 오류 문구 아래에 같은 "해결:" 줄을 보여 준다.'),
  table(['코드', '해결'], Object.entries(ERROR_HINTS).map(([code, hint]) => [code, hint]), [3, 7]),
];

// ── 교육 자료: 역할별 빠른 시작 ───────────────────────────────────────
const quick = [
  ...cover('교육 자료 — 역할별 빠른 시작', '처음 하루 따라 하기', [
    ['과업', '제안요청서 산출물5 "어플 사용 교육 자료 1편(게시판 탑재)"'],
    ['작성일', TODAY],
    ['쓰는 법', '자기 역할 장만 읽고 순서대로 따라 한다. 자세한 설명은 사용자 매뉴얼과 화면의 "? 도움말"'],
  ], { toc: false }),
  h1('지점 관리자 — 첫 출근'),
  ...numbered([
    '로그인하면 **대시보드 "처리 대기"**부터 본다. 승인 대기 휴가·인사 변경 신청·오늘 체크인 대기 예약·혼잡도 미갱신 시설이 뜬다.',
    '**시설·혼잡도** — 운영 중인 시설의 현재 인원을 넣는다. 30분이 넘으면 회원 앱에 "갱신되지 않음"이 뜬다.',
    '**예약 관리** — 오늘 회차의 예약을 확인하고 온 회원은 "체크인"을 누른다.',
    '**근태관리** — 휴가 승인함에서 승인·반려하고, 월말에 결근 확정을 한다.',
    '**회원** — 데스크에서 온 신규 회원은 "+ 회원 등록"으로 등록하고, 회원번호를 알려 주면 회원 앱과 연결할 수 있다.',
  ]),
  ...figure('manual/ba-dashboard', '지점 관리자 대시보드 — 처리 대기와 메뉴 옆 숫자', 0.95),
  h1('지점 직원 — 하루 업무'),
  ...numbered([
    '출근하면 **근태관리 → 체크인**, 퇴근할 때 **체크아웃**. 대시보드 "처리 대기"에 "오늘 출근 체크 전"이 떠 있으면 아직 안 한 것이다.',
    '퇴근 전에 **업무일지**를 남긴다.',
    '휴가는 근태관리의 **휴가 신청**에서 종류·기간을 넣는다. 승인되면 남은 연차·사용 일수가 바뀐다.',
    '연락처가 바뀌면 **내 정보 → 변경 신청**을 한다. 지점 관리자가 승인하면 반영된다.',
  ]),
  ...figure('manual/st-attendance', '지점 직원 — 근태관리(체크인·휴가 신청)', 0.95),
  h1('본사 관리자 — 주간 점검'),
  ...numbered([
    '**대시보드 "처리 대기"** — 업무지원 요청·갱신 임박·만료 지점·재배치 대기 직원·보존기한 임박 문서를 확인한다.',
    '**업무지원 요청** — 처리중·완료·반려로 바꾸고 답변을 남긴다.',
    '**지점 상세** — 계약 상태와 3개월 운영 실적(회원·매출·프로그램)을 갱신 협상 근거로 본다.',
    '**권한 관리** — 직원 역할 전환, "역할 기본 권한"에서 지점 관리자·직원이 쓸 기능을 끄고 켠다. 한 사람만 다르게 하려면 직원 상세 "개인 권한".',
    '**변경 이력** — 인사·권한·전화번호 열람 기록을 확인한다.',
  ]),
  ...figure('manual/hq-permissions', '본사 — 권한 관리 › 역할 기본 권한', 0.95),
  h1('회원 — 앱 처음 쓰기'),
  ...numbered([
    '휴대폰으로 회원 앱에 들어가 계정을 연결(이미 등록한 회원)하거나 가입한다.',
    '**홈**에서 시설 혼잡도와 최근 공지를 본다.',
    '**예약하기** → 프로그램 → 회차 → 예약(유료는 결제까지).',
    '**내 예약**에서 확인·취소. 기준 시간 전 취소는 전액 환불.',
  ]),
  ...figure('manual/m-home', '회원 앱 홈', 0.38),
  callout('막히면', ['화면 오른쪽 위 **"? 도움말"**(관리자 웹) 또는 **"이용 안내"**(회원 앱)를 연다. 오류 문구 아래 "해결:" 줄을 따라 한다.']),
];

build(path.join(OUT_DIR, '사용자매뉴얼.docx'), '사용자 매뉴얼', manual).then(() =>
  build(path.join(OUT_DIR, '교육자료_빠른시작.docx'), '교육 자료 — 역할별 빠른 시작', quick),
).then(() => {
  // 게시판에 올릴 PDF — LibreOffice가 있으면 만든다(없으면 Word에서 PDF로 저장).
  try {
    execSync(`soffice --headless --convert-to pdf --outdir "${OUT_DIR}" "${path.join(OUT_DIR, '교육자료_빠른시작.docx')}"`, { stdio: 'ignore' });
    console.log('교육자료_빠른시작.pdf 생성');
  } catch {
    console.log('soffice 없음 — PDF는 Word에서 저장');
  }
});
