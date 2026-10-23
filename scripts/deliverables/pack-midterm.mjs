// 중간 제출 폴더 조립(D67) — 한 폴더에 모으고 압축은 사용자가 한다.
//   node scripts/deliverables/pack-midterm.mjs [출력 폴더]   → 기본 ./중간제출 (저장소에는 올리지 않는다 — .gitignore)
// 저장소에 있는 것(RFP 이행 증빙, 산출물)은 docs/deliverables에서 복사한다. 아티팩트로만 있는 것(중간보고서 덱, 주차별
// 발표자료)은 사용자가 내보내 빈 폴더에 넣는다 — 폴더마다 무엇을 넣을지 README.txt에 적는다.
// 산출물을 고쳤다면 먼저 각 생성기(scripts/deliverables/*)로 다시 만든 뒤 이 스크립트를 돌린다.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;
const SRC = join(ROOT, 'docs/deliverables');
const OUT = process.argv[2] ?? join(ROOT, '중간제출');

const DIRS = {
  report: '01_중간보고서',
  evidence: '02_RFP이행증빙',
  weekly: '03_주차별발표자료',
  outputs: '04_산출물',
};
// 산출물 — 파일 이름 → 한 줄 설명(README에 그대로 쓴다)
const OUTPUTS = [
  ['요구사항정의서.xlsx', 'RFP 추적·조항별 충족 판정·기능 목록·API 목록'],
  ['데이터정의서.xlsx', '테이블·컬럼·코드·제약 전체(스키마에서 생성)'],
  ['기업분석및제안서.docx', '과업1 기업 분석 + 시스템 제안(산출물2)'],
  ['아키텍처설계서.docx', '시스템 구성·구조·데이터·배포·성능 설계(산출물3 대체)'],
  ['사용자매뉴얼.docx', '역할별 사용 순서·화면 캡처·오류 해결(과업4)'],
  ['교육자료_빠른시작.pdf', '역할별 빠른 시작 1편 — 운영 게시판 "직원 교육자료"에 탑재(산출물5)'],
  ['진행보고서_1_분석설계.docx', '단계별 개발 진행 보고서 1/5(산출물4)'],
  ['진행보고서_2_실DB전환_배포.docx', '단계별 개발 진행 보고서 2/5'],
  ['진행보고서_3_기능구현_RFP.docx', '단계별 개발 진행 보고서 3/5'],
  ['진행보고서_4_테스트_검증.docx', '단계별 개발 진행 보고서 4/5'],
  ['진행보고서_5_완성_산출물.docx', '단계별 개발 진행 보고서 5/5'],
];
const EVIDENCE = 'RFP이행증빙.pdf';

for (const f of [EVIDENCE, ...OUTPUTS.map(([n]) => n)])
  if (!existsSync(join(SRC, f))) throw new Error(`docs/deliverables에 없음: ${f} — 생성기를 먼저 돌린다`);
const known = new Set([EVIDENCE, ...OUTPUTS.map(([n]) => n), '교육자료_빠른시작.docx']);
const unknown = readdirSync(SRC).filter((f) => !known.has(f));
if (unknown.length) throw new Error(`목록에 없는 산출물: ${unknown.join(', ')} — OUTPUTS에 넣을지 정한다`);

rmSync(OUT, { recursive: true, force: true });
for (const d of Object.values(DIRS)) mkdirSync(join(OUT, d), { recursive: true });
copyFileSync(join(SRC, EVIDENCE), join(OUT, DIRS.evidence, EVIDENCE));
for (const [n] of OUTPUTS) copyFileSync(join(SRC, n), join(OUT, DIRS.outputs, n));

const DEMO = 'https://sports-erp-api-gateway.01-beauty-minimal.workers.dev';
const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const readme = `스포이즘 ERP — 중간 제출 묶음
기준일 ${today}

제출 요구는 "프로젝트 중간보고서"와 "각 주차별 발표자료 및 증빙자료"다. 이 묶음은 그것을
아래 네 폴더로 해석했다. 처음 보신다면 01의 중간보고서 하나만 읽어도 전체 맥락과 RFP 이행
현황을 알 수 있게 만들었고, 나머지는 그 근거다.

────────────────────────────────────────
01_중간보고서
  중간보고서.pdf — 혼자 넘겨 읽는 슬라이드 보고서(55장).
  Ⅰ 들어가며 · Ⅱ 맥락(사업 구조, 기능이 맞물리는 지도, 본사·지점·회원의 하루) · Ⅲ 설계 ·
  Ⅳ RFP 이행 현황(72조항을 원문 순서대로) · Ⅴ 확인 · Ⅵ 진행 경과 · Ⅶ 마무리.
  맥락만 보시려면 Ⅱ장까지 읽으면 된다.

02_RFP이행증빙
  ${EVIDENCE} — 제안요청서 72조항마다 원문, 이행 상태, 구현한 것(한 줄), 결정 기록, 실제 화면.
  앞쪽 "한눈 표"로 전체를 보고, 궁금한 조항 번호를 찾아가면 된다. 중간보고서 Ⅳ장의 문장과 같다.

03_주차별발표자료
  1~6주차와 종합 발표에 실제로 쓴 발표자료. 6주차 발표(10/11) 이후 작업은 어떤 발표에도
  나온 적이 없어 중간보고서 Ⅵ장에 펼쳐 두었다.

04_산출물 — 제안요청서 산출물 표(p.7)에 맞춰 2026-10-23 기준으로 다시 만든 문서
${OUTPUTS.map(([n, d]) => `  ${n}\n      ${d}`).join('\n')}

────────────────────────────────────────
직접 써 보기(시연용 — 실제 운영 서비스가 아니다)
  관리자 웹  ${DEMO}
  회원 앱    ${DEMO}/m/   (휴대폰으로 열면 홈 화면에 설치할 수 있다)
  로그인 화면의 데모 계정 버튼을 누르면 비밀번호 입력 없이 들어간다.
    본사        대시보드 → 마포점(갱신 임박) 운영 실적 → 권한 관리
    지점 관리자  회원 → 회원 상세 → 예약 관리의 주간 시간표
    회원        예약하기 → 결제(모의) → 홈 혼잡도
  시연 데이터는 공용이라 다른 사람이 바꿔 놓았을 수 있다.
`;
writeFileSync(join(OUT, 'README.txt'), readme);

// 사용자가 채울 폴더 — 무엇을 넣을지 적어 둔다(압축 전에 이 안내 파일은 지워도 된다)
writeFileSync(join(OUT, DIRS.report, '여기에_넣을_것.txt'), `중간보고서 덱을 PDF로 내보내 "중간보고서.pdf"로 넣는다.
덱: https://claude.ai/artifact/M2NBGeZcaBdTgkT1msjwQb (Share › Export › PDF)
다 넣었으면 이 파일은 지운다.
`);
writeFileSync(join(OUT, DIRS.weekly, '여기에_넣을_것.txt'), `발표에 쓴 덱을 PDF로 내보내 넣는다(파일 이름 예: 3주차_발표자료.pdf).
  1주차(9/7)·2주차(9/14) — 당시 PPT(저장소 docs/presentation/스포이즘 ERP_1.pptx가 어느 주차인지 확인)
  3주차(9/21)  https://claude.ai/artifact/GBiFad42sswiYAs82BUqLU
  4주차(9/28)  https://claude.ai/artifact/HGeWH6auvL1k9TjjCo31Hk
  종합(10/5)   https://claude.ai/artifact/M6jdRHTH54pfGy884PiyxG
  6주차(10/11) https://claude.ai/artifact/Tk7TD8yx1bWthxvGsVHxpQ
다 넣었으면 이 파일은 지운다.
`);
console.log(`작성: ${OUT}`);
console.log(`  ${DIRS.evidence}/${EVIDENCE}, ${DIRS.outputs}/ ${OUTPUTS.length}개, README.txt`);
console.log(`  사용자가 채울 곳: ${DIRS.report}/ (중간보고서 PDF), ${DIRS.weekly}/ (주차별 발표자료)`);
