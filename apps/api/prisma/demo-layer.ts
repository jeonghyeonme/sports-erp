/**
 * 시연용 고밀도 데이터 층 — D58. 기준 시드(prisma/seed.ts, 5개 지점 최소 데이터) 위에 얹는다.
 *
 * - 결정적: 고정 씨앗 PRNG(mulberry32)만 쓴다. Math.random은 쓰지 않는다. 같은 날 돌리면 같은 데이터다.
 * - 상대 날짜: 시드 실행일(KST) 기준 지난 90일 이력 + 앞으로 3주 회차. 계약 종료 지점은 종료일까지 90일만 있고 미래 활동이 없다.
 * - 새 행 id는 전부 `demo-`로 시작한다. 이미 얹힌 DB에는 다시 얹지 않는다(빈 DB에 기준 시드부터 다시 돌릴 것).
 * - 히어로 데이터(서초·강남 계정·직원·회원·회차)의 관계는 바꾸지 않는다. 히어로에 더하는 것은 이력(근태·업무일지·지난 회차 예약)뿐이다.
 *
 * 쓰는 곳: `npm run seed:demo`(prisma/seed-demo.ts — 시연·배포용 DB)와 jest 고밀도 템플릿(test/setup/global-setup.ts).
 */
import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { MOCK_DEMO_PASSWORD } from '../src/fixtures/demo-password';

const SEED = 20261018;
const HISTORY_DAYS = 90;
const FUTURE_DAYS = 21;

// ── 결정적 난수 ─────────────────────────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  private readonly next: () => number;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  float() {
    return this.next();
  }
  int(min: number, max: number) {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  chance(p: number) {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  sample<T>(arr: readonly T[], n: number): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.max(0, Math.min(n, copy.length)));
  }
  hex(len: number) {
    let s = '';
    for (let i = 0; i < len; i++) s += Math.floor(this.next() * 16).toString(16);
    return s.toUpperCase();
  }
}

// ── 날짜(KST 날짜 문자열 기준) ───────────────────────────
const DAY_MS = 86_400_000;
function kstToday(now: Date): string {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}
function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS);
}
const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const weekday = (d: string) => asDate(d).getUTCDay();
/** KST 날짜 + 분(0시 기준) → 시각 */
function kstAt(date: string, minutes: number): Date {
  return new Date(Date.parse(`${date}T00:00:00+09:00`) + minutes * 60_000);
}
const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const pad = (n: number, w: number) => String(n).padStart(w, '0');

// ── 원천 목록 ───────────────────────────────────────────
const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍'];
const GIVEN = [
  '민준', '서연', '도윤', '하은', '지호', '수아', '예준', '지유', '시우', '서윤', '주원', '하린', '지후', '채원', '준서',
  '지민', '건우', '윤서', '현우', '다은', '우진', '소율', '선우', '예린', '연우', '수빈', '유준', '지안', '은우', '가은',
];

interface ProgramTemplate {
  key: string;
  name: string;
  category: string;
  ageGroup: 'ALL' | 'CHILD' | 'TEEN' | 'ADULT' | 'SENIOR';
  price: number;
  capacity: number;
  days: number[];
  start: string;
  end: string;
  facility: 'gym' | 'pool' | 'gx' | 'golf';
}
// 시간대 필터(ADR-PRG-04)와 종목·연령대 필터가 모두 의미 있게 걸리도록 오전·오후·저녁, 여러 종목·연령대를 섞었다.
const CLASS_POOL: readonly ProgramTemplate[] = [
  { key: 'swim-dawn', name: '새벽 수영', category: '수영', ageGroup: 'ADULT', price: 35000, capacity: 12, days: [1, 3, 5], start: '06:30', end: '07:20', facility: 'pool' },
  { key: 'swim-kids', name: '어린이 수영', category: '수영', ageGroup: 'CHILD', price: 30000, capacity: 10, days: [2, 4], start: '16:00', end: '16:50', facility: 'pool' },
  { key: 'pilates-eve', name: '저녁 필라테스', category: '필라테스', ageGroup: 'ADULT', price: 38000, capacity: 8, days: [1, 3], start: '19:30', end: '20:20', facility: 'gx' },
  { key: 'senior-fit', name: '시니어 건강체조', category: 'GX', ageGroup: 'SENIOR', price: 15000, capacity: 20, days: [2, 4], start: '10:00', end: '10:50', facility: 'gx' },
  { key: 'spin-lunch', name: '점심 스피닝', category: '스피닝', ageGroup: 'ADULT', price: 20000, capacity: 15, days: [1, 3, 5], start: '12:10', end: '12:50', facility: 'gx' },
  { key: 'golf-basic', name: '골프 입문반', category: '골프', ageGroup: 'ADULT', price: 45000, capacity: 6, days: [2, 6], start: '20:00', end: '20:50', facility: 'golf' },
  { key: 'yoga-family', name: '주말 가족 요가', category: '요가', ageGroup: 'ALL', price: 25000, capacity: 16, days: [6], start: '10:00', end: '11:00', facility: 'gx' },
  { key: 'teen-strength', name: '청소년 근력교실', category: '헬스', ageGroup: 'TEEN', price: 22000, capacity: 12, days: [2, 4], start: '17:30', end: '18:20', facility: 'gym' },
  { key: 'zumba-eve', name: '줌바 댄스', category: 'GX', ageGroup: 'ADULT', price: 18000, capacity: 18, days: [2, 5], start: '18:40', end: '19:30', facility: 'gx' },
];

const FACILITY_SPECS = {
  pool: { type: 'POOL', name: '수영장', capacity: 35 },
  gx: { type: 'ETC', name: 'GX룸', capacity: 25 },
  golf: { type: 'GOLF', name: '실내 골프연습장', capacity: 10 },
} as const;

const WORK_LOG_LINES = [
  '오전 PT 3건 진행, 신규 회원 상담 1건',
  '헬스장 기구 점검 — 러닝머신 벨트 장력 조정',
  '수업 출석 확인 및 노쇼 회원 연락',
  '신규 회원 오리엔테이션 진행',
  '락커 정리 및 분실물 접수',
  'GX룸 음향 장비 점검, 수업 2건 진행',
  '회원 문의 응대(수강 변경·환불 안내)',
  '소독제·수건 재고 확인 후 발주 요청',
  '야간 마감 점검 — 출입문·전원 확인',
  '주간 수업 일정표 게시판 갱신',
];

const POST_TITLES_HQ = [
  ['NOTICE', '분기 안전점검 일정 안내', '전 지점은 이번 달 말까지 소방·전기 안전점검을 마치고 결과를 문서함에 올려 주세요.'],
  ['TRAINING_MATERIAL', '신규 직원 응대 교육 자료', '회원 응대 기본 수칙과 민원 처리 절차를 정리한 교육 자료입니다.'],
  ['NOTICE', '개인정보 처리 지침 변경 안내', '회원 연락처 열람 시 사유 입력이 의무화되었습니다. 변경 내용을 숙지해 주세요.'],
  ['EVENT', '하반기 회원 만족도 조사 실시', '하반기 회원 만족도 조사를 실시합니다. 지점별로 회원 안내 부탁드립니다.'],
  ['TRAINING_MATERIAL', '응급처치(AED) 재교육 영상', '연 1회 의무 재교육 영상입니다. 시청 후 지점장에게 확인을 받으세요.'],
  ['NOTICE', 'ERP 정기 점검 안내', '이번 주 일요일 새벽 2시~4시 ERP 정기 점검이 있습니다.'],
  ['OTHER', '지점 운영 우수 사례 공유', '회원 재등록률이 높은 지점의 운영 사례를 공유합니다.'],
] as const;
const POST_TITLES_BRANCH = [
  ['NOTICE', '시설 휴관 안내', '정기 소독으로 다음 주 월요일 오전 시설 이용이 제한됩니다.'],
  ['EVENT', '신규 수업 체험 이벤트', '신규 개설 수업 1회 무료 체험을 진행합니다. 프론트에 문의해 주세요.'],
  ['NOTICE', '수업 시간 변경 안내', '일부 수업 시간이 변경되었습니다. 예약 화면에서 확인해 주세요.'],
  ['EVENT', '회원 추천 이벤트', '지인을 추천하시면 두 분 모두 PT 1회를 드립니다.'],
  ['NOTICE', '주차 안내', '단지 내 공사로 방문 차량 주차가 지하 2층으로 변경됩니다.'],
  ['OTHER', '분실물 보관 안내', '분실물은 프론트에서 2주간 보관 후 폐기합니다.'],
] as const;

const ASSET_POOL = [
  ['러닝머신', 'EXERCISE_EQUIPMENT', 'FIXED_ASSET', 3200000, 5, '헬스장'],
  ['스미스 머신', 'EXERCISE_EQUIPMENT', 'FIXED_ASSET', 2800000, 7, '헬스장'],
  ['실내 자전거', 'EXERCISE_EQUIPMENT', 'FIXED_ASSET', 1400000, 5, 'GX룸'],
  ['덤벨 세트', 'EXERCISE_EQUIPMENT', 'CONSUMABLE', 450000, null, '헬스장'],
  ['요가 매트', 'EXERCISE_EQUIPMENT', 'CONSUMABLE', 25000, null, 'GX룸'],
  ['AED(자동심장충격기)', 'SAFETY_EQUIPMENT', 'FIXED_ASSET', 1800000, 7, '프론트'],
  ['소화기', 'SAFETY_EQUIPMENT', 'CONSUMABLE', 35000, null, '복도'],
  ['구급함', 'SAFETY_EQUIPMENT', 'CONSUMABLE', 60000, null, '프론트'],
  ['프론트 데스크', 'OFFICE_FURNITURE', 'FIXED_ASSET', 1200000, 8, '프론트'],
  ['락커(20칸)', 'OFFICE_FURNITURE', 'FIXED_ASSET', 1600000, 10, '탈의실'],
  ['소독제', 'OTHER', 'CONSUMABLE', 12000, null, '창고'],
  ['수건', 'OTHER', 'CONSUMABLE', 3000, null, '창고'],
] as const;

const SUPPORT_POOL = [
  ['FACILITY', '수영장 보일러 점검 요청', '수온이 기준보다 2도 낮게 유지됩니다. 보일러 점검 업체 방문을 요청합니다.'],
  ['STAFFING', '주말 GX 강사 충원 요청', '주말 수업 수요가 늘어 강사 1명 추가 배치를 요청합니다.'],
  ['SUPPLIES', '요가 매트 교체 요청', '매트 10장이 낡아 교체가 필요합니다.'],
  ['IT', '프론트 PC 프린터 연결 오류', '회원 영수증 출력이 되지 않습니다.'],
  ['FACILITY', '샤워실 배수 불량', '남자 샤워실 배수가 느립니다. 배관 점검을 요청합니다.'],
  ['OTHER', '입주민 설명회 자료 요청', '다음 달 입주민 설명회에서 쓸 운영 실적 자료를 요청합니다.'],
] as const;

// ── 지점별 규모 ─────────────────────────────────────────
// 기준 시드 직원 수(서초 2·강남 1·나머지 2)에 더해 지점당 4~6명, 회원 30~60명이 되게 한다.
const BRANCH_PLAN: Record<string, { extraStaff: number; members: number; classes: number }> = {
  'branch-seocho': { extraStaff: 4, members: 58, classes: 5 },
  'branch-gangnam': { extraStaff: 4, members: 48, classes: 5 },
  'branch-mapo': { extraStaff: 2, members: 40, classes: 4 },
  'branch-songpa': { extraStaff: 2, members: 35, classes: 4 },
  'branch-nowon': { extraStaff: 2, members: 30, classes: 3 },
};

export interface DemoLayerSummary {
  today: string;
  counts: Record<string, number>;
}

async function insertMany<T>(label: string, rows: T[], create: (chunk: T[]) => Promise<unknown>, counts: Record<string, number>) {
  for (let i = 0; i < rows.length; i += 1000) await create(rows.slice(i, i + 1000));
  counts[label] = (counts[label] ?? 0) + rows.length;
}

export async function applyDemoLayer(prisma: PrismaClient, now = new Date()): Promise<DemoLayerSummary> {
  if (await prisma.account.findFirst({ where: { id: { startsWith: 'demo-' } }, select: { id: true } })) {
    throw new Error('이미 시연 데이터 층이 얹힌 DB다 — 빈 DB에 기준 시드부터 다시 돌릴 것(prisma migrate reset).');
  }
  const rng = new Rng(SEED);
  const today = kstToday(now);
  const yesterday = addDays(today, -1);
  const year = Number(today.slice(0, 4));
  const passwordHash = await bcrypt.hash(MOCK_DEMO_PASSWORD, 10);
  const counts: Record<string, number> = {};
  const nowMs = now.getTime();
  const notAfterNow = (d: Date) => new Date(Math.min(d.getTime(), nowMs - 3_600_000));

  const branches = await prisma.branch.findMany({ orderBy: { id: 'asc' } });
  const planned = branches.filter((b) => BRANCH_PLAN[b.id]);
  const hq = await prisma.account.findFirstOrThrow({ where: { role: 'SUPER_ADMIN', isActive: true }, orderBy: { id: 'asc' } });

  // 채번 — 기존 번호의 최대 순번에서 이어 간다(시퀀스는 마지막에 맞춘다, data-integrity §5).
  const seq = new Map<string, { branchId: string; kind: 'STAFF' | 'MEMBER' | 'ASSET'; prefix: string; lastValue: number }>();
  for (const s of await prisma.codeSequence.findMany()) seq.set(`${s.kind}|${s.prefix}`, { ...s, kind: s.kind });
  const nextCode = (kind: 'STAFF' | 'MEMBER' | 'ASSET', branchId: string, prefix: string) => {
    const key = `${kind}|${prefix}`;
    const cur = seq.get(key) ?? { branchId, kind, prefix, lastValue: 0 };
    cur.lastValue += 1;
    seq.set(key, cur);
    return cur.lastValue;
  };

  const accounts: Prisma.AccountCreateManyInput[] = [];
  const staffRows: Prisma.StaffCreateManyInput[] = [];
  const assignments: Prisma.StaffAssignmentCreateManyInput[] = [];
  const facilities: Prisma.FacilityCreateManyInput[] = [];
  const instructors: Prisma.InstructorCreateManyInput[] = [];
  const programs: Prisma.ProgramCreateManyInput[] = [];
  const templates: Prisma.ProgramScheduleTemplateCreateManyInput[] = [];
  const slots: Prisma.ScheduleSlotCreateManyInput[] = [];
  const members: Prisma.MemberCreateManyInput[] = [];
  const reservations: Prisma.ReservationCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const enrollments: Prisma.CourseEnrollmentCreateManyInput[] = [];
  const ptSessions: Prisma.PTSessionCreateManyInput[] = [];
  const ptLogs: Prisma.PTSessionLogCreateManyInput[] = [];
  const posts: Prisma.PostCreateManyInput[] = [];
  const receipts: Prisma.PostReadReceiptCreateManyInput[] = [];
  const assets: Prisma.AssetCreateManyInput[] = [];
  const documents: Prisma.DocumentCreateManyInput[] = [];
  const supports: Prisma.SupportRequestCreateManyInput[] = [];
  const snapshots: Prisma.CongestionSnapshotCreateManyInput[] = [];
  const changeRequests: Prisma.StaffProfileChangeRequestCreateManyInput[] = [];
  const leaveRequests: Prisma.LeaveRequestCreateManyInput[] = [];
  const leaveBalances: Prisma.LeaveBalanceCreateManyInput[] = [];
  const attendance: Prisma.AttendanceRecordCreateManyInput[] = [];
  const workLogs: Prisma.WorkLogCreateManyInput[] = [];

  const personName = () => `${rng.pick(SURNAMES)}${rng.pick(GIVEN)}`;
  const phone = () => `010-${rng.int(2000, 9899)}-${pad(rng.int(0, 9999), 4)}`;
  const vat = (amount: number) => {
    const supplyAmount = Math.round(amount / 1.1);
    return { supplyAmount, vat: amount - supplyAmount };
  };

  // 지점별 활동 기간 — 계약 종료 지점은 종료일까지, 나머지는 어제까지(+ 앞으로 3주 회차)
  const windowOf = (b: (typeof branches)[number]) => {
    const terminated = b.contractStatus === 'TERMINATED';
    const end = terminated && b.contractEndAt ? b.contractEndAt.toISOString().slice(0, 10) : yesterday;
    return { start: addDays(end, -(HISTORY_DAYS - 1)), end, future: terminated ? 0 : FUTURE_DAYS, terminated };
  };

  // 지점 간 파견 이력을 만들 때 쓸 이전 지점(운영 중인 다른 지점)
  const activeBranchIds = planned.filter((b) => b.contractStatus !== 'TERMINATED').map((b) => b.id);

  const memberPoolByBranch = new Map<string, Array<{ id: string; status: string; joinedAt: string }>>();
  const staffByBranch = new Map<string, Array<{ id: string; accountId: string; trainer: boolean }>>();

  for (const b of planned) {
    const plan = BRANCH_PLAN[b.id];
    const key = b.id.replace(/^branch-/, '');
    const win = windowOf(b);
    const contractEnd = win.terminated ? win.end : undefined;

    // ── 직원·계정·파견 ──
    const branchStaff: Array<{ id: string; accountId: string; trainer: boolean }> = [];
    for (let n = 1; n <= plan.extraStaff; n++) {
      const id = `demo-staff-${key}-${n}`;
      const accountId = `demo-account-${key}-s${n}`;
      const name = personName();
      const partTime = n === plan.extraStaff; // 지점마다 마지막 한 명은 파트타임
      const position = partTime ? '트레이너' : rng.pick(['트레이너', '트레이너', '매니저', '행정직원']);
      const hireDate = addDays(today, -rng.int(200, 1400));
      accounts.push({ id: accountId, email: `demo.${key}.s${n}@staff.spoism.example`, passwordHash, role: 'STAFF', name, isActive: true });
      staffRows.push({
        id,
        accountId,
        branchId: b.id,
        staffCode: `${b.code}-${pad(nextCode('STAFF', b.id, `${b.code}-`), 3)}`,
        name,
        phone: phone(),
        position,
        employmentType: partTime ? '파트타임' : '정규직',
        offDays: partTime ? [] : rng.pick([[0, 6], [0, 1], [0, 3]]),
        hireDate: asDate(hireDate),
        status: 'ACTIVE',
      });
      // 운영 중 지점의 첫 직원은 45일 전에 다른 지점에서 옮겨 왔다(파견 이력, ADR-STF-03)
      const transferred = n === 1 && !win.terminated && activeBranchIds.length > 1;
      if (transferred) {
        const prev = activeBranchIds[(activeBranchIds.indexOf(b.id) + 1) % activeBranchIds.length];
        const moved = addDays(today, -45);
        assignments.push({ id: `demo-assignment-${key}-${n}-a`, staffId: id, branchId: prev, startDate: asDate(hireDate), endDate: asDate(addDays(moved, -1)), assignedBy: hq.id, note: '최초 배치' });
        assignments.push({ id: `demo-assignment-${key}-${n}-b`, staffId: id, branchId: b.id, startDate: asDate(moved), assignedBy: hq.id, note: '인력 재배치' });
      } else {
        assignments.push({ id: `demo-assignment-${key}-${n}`, staffId: id, branchId: b.id, startDate: asDate(hireDate), endDate: contractEnd ? asDate(contractEnd) : null, assignedBy: hq.id });
      }
      branchStaff.push({ id, accountId, trainer: position === '트레이너' });
      leaveBalances.push({ id: `demo-leave-balance-${key}-${n}`, staffId: id, year, totalDays: annualLeaveTotal(hireDate, year), usedDays: 0 });
    }
    staffByBranch.set(b.id, branchStaff);

    // ── 시설·강사·프로그램·회차 ──
    const baseGym = await prisma.facility.findFirst({ where: { branchId: b.id, type: 'GYM' }, orderBy: { id: 'asc' } });
    const classes = rng.sample(CLASS_POOL, plan.classes);
    const facilityIdByKind = new Map<string, string>();
    if (baseGym) facilityIdByKind.set('gym', baseGym.id);
    for (const kind of new Set(classes.map((c) => c.facility))) {
      if (facilityIdByKind.has(kind) || kind === 'gym') continue;
      const spec = FACILITY_SPECS[kind as keyof typeof FACILITY_SPECS];
      const fid = `demo-facility-${key}-${kind}`;
      const current = win.terminated ? 0 : rng.int(2, Math.floor(spec.capacity * 0.8));
      facilities.push({
        id: fid,
        branchId: b.id,
        name: `${b.name} ${spec.name}`,
        type: spec.type,
        capacity: spec.capacity,
        currentCount: current,
        level: congestionLevel(current, spec.capacity),
        lastUpdatedAt: kstAt(win.end, 18 * 60),
        isActive: !win.terminated,
      });
      facilityIdByKind.set(kind, fid);
    }
    const trainers = branchStaff.filter((s) => s.trainer);
    const instructorIds: string[] = [];
    for (const t of trainers) {
      const iid = `demo-instructor-${t.id.replace(/^demo-staff-/, '')}`;
      const st = staffRows.find((s) => s.id === t.id)!;
      instructors.push({ id: iid, branchId: b.id, staffId: t.id, name: st.name, specialty: rng.pick(['요가·필라테스', '수영', '웨이트', 'GX', '골프']), isActive: !win.terminated });
      instructorIds.push(iid);
    }
    const externalId = `demo-instructor-${key}-ext`;
    instructors.push({ id: externalId, branchId: b.id, name: personName(), specialty: '외부 초빙', phone: phone(), isActive: !win.terminated });
    instructorIds.push(externalId);

    const programStart = addDays(win.start, -rng.int(30, 200));
    const classPrograms: Array<{ id: string; tpl: ProgramTemplate; price: number }> = [];
    for (const [ci, tpl] of classes.entries()) {
      const pid = `demo-program-${key}-${tpl.key}`;
      programs.push({
        id: pid,
        branchId: b.id,
        facilityId: facilityIdByKind.get(tpl.facility) ?? baseGym?.id ?? null,
        instructorId: instructorIds[ci % instructorIds.length],
        name: tpl.name,
        category: tpl.category,
        ageGroup: tpl.ageGroup,
        description: `${b.name} ${tpl.name} — 주 ${tpl.days.length}회 ${tpl.start}~${tpl.end}`,
        pricingType: 'PAID_SESSION',
        price: tpl.price,
        capacity: tpl.capacity,
        status: win.terminated ? 'ENDED' : 'RUNNING',
        startDate: asDate(programStart),
        endDate: contractEnd ? asDate(contractEnd) : null,
      });
      tpl.days.forEach((dow, ti) => templates.push({ id: `demo-template-${key}-${tpl.key}-${ti}`, programId: pid, dayOfWeek: dow, startTime: tpl.start, endTime: tpl.end }));
      classPrograms.push({ id: pid, tpl, price: tpl.price });
    }
    // 개강 준비 중 프로그램 1개(운영 중 지점만) — 목록 상태 필터·회원 노출 규칙이 보이게
    if (!win.terminated) {
      programs.push({
        id: `demo-program-${key}-preparing`,
        branchId: b.id,
        facilityId: baseGym?.id ?? null,
        instructorId: instructorIds[0],
        name: '다음 달 개강 — 코어 트레이닝',
        category: '헬스',
        ageGroup: 'ADULT',
        description: '다음 달 개강 예정인 소규모 코어 트레이닝 수업입니다.',
        pricingType: 'PAID_SESSION',
        price: 30000,
        capacity: 10,
        status: 'PREPARING',
        startDate: asDate(addDays(today, 30)),
      });
    }
    // PT 패키지(서초는 히어로 PT가 있다)
    const ptProgramId = b.id === 'branch-seocho' ? 'program-seocho-pt' : `demo-program-${key}-pt`;
    if (b.id !== 'branch-seocho') {
      programs.push({
        id: ptProgramId,
        branchId: b.id,
        facilityId: baseGym?.id ?? null,
        instructorId: instructorIds[0],
        name: '1:1 퍼스널 트레이닝',
        category: 'PT',
        ageGroup: 'ADULT',
        description: '1:1 맞춤 트레이닝(세션 차감형).',
        pricingType: 'PT_PACKAGE',
        price: 60000,
        status: win.terminated ? 'ENDED' : 'RUNNING',
        startDate: asDate(programStart),
        endDate: contractEnd ? asDate(contractEnd) : null,
      });
    }

    // 회차 — 지난 90일 + 앞으로 3주. 히어로 '아침 요가'에도 지난 회차를 더한다(미래 회차는 히어로 2건 그대로).
    const slotSpecs: Array<{ programId: string; days: number[]; start: string; end: string; capacity: number; price: number; futureToo: boolean }> =
      classPrograms.map((c) => ({ programId: c.id, days: c.tpl.days, start: c.tpl.start, end: c.tpl.end, capacity: c.tpl.capacity, price: c.price, futureToo: true }));
    if (b.id === 'branch-seocho') {
      slotSpecs.push({ programId: 'program-seocho-yoga', days: [1, 3], start: '07:00', end: '08:00', capacity: 15, price: 30000, futureToo: false });
    }

    // ── 회원 ──
    const branchMembers: Array<{ id: string; status: string; joinedAt: string }> = [];
    for (let n = 1; n <= plan.members; n++) {
      const id = `demo-member-${key}-${n}`;
      const joinedAt = addDays(win.end, -rng.int(5, 700));
      const joinYear = joinedAt.slice(0, 4);
      const prefix = `${b.code}${joinYear}`;
      const ageRoll = rng.float();
      const birthYear = ageRoll < 0.12 ? rng.int(year - 12, year - 7) : ageRoll < 0.2 ? rng.int(year - 18, year - 13) : ageRoll < 0.85 ? rng.int(year - 60, year - 20) : rng.int(year - 80, year - 65);
      const minor = year - birthYear < 19;
      const status = win.terminated ? rng.pick(['DORMANT', 'DORMANT', 'WITHDRAWN', 'ACTIVE'] as const) : rng.chance(0.86) ? 'ACTIVE' : rng.chance(0.7) ? 'DORMANT' : 'WITHDRAWN';
      const hasAccount = !win.terminated && n <= 4; // 지점마다 회원 웹 로그인 계정 4개
      const name = personName();
      if (hasAccount) accounts.push({ id: `demo-account-${key}-m${n}`, email: `demo.${key}.m${n}@example.com`, passwordHash, role: 'MEMBER', name, isActive: true });
      const assignable = !win.terminated && trainers.length > 0 && rng.chance(0.55);
      members.push({
        id,
        accountId: hasAccount ? `demo-account-${key}-m${n}` : null,
        branchId: b.id,
        assignedStaffId: assignable ? rng.pick(trainers).id : null,
        memberNo: `${prefix}-${pad(nextCode('MEMBER', b.id, prefix), 3)}`,
        name,
        phone: phone(),
        birthDate: asDate(`${birthYear}-${pad(rng.int(1, 12), 2)}-${pad(rng.int(1, 28), 2)}`),
        gender: rng.pick(['M', 'F']),
        joinedAt: asDate(joinedAt),
        status,
        guardianConsent: minor,
        memo: rng.chance(0.12) ? rng.pick(['허리 통증 이력 — 무리한 동작 주의', '평일 저녁만 이용 가능', '수영 초급', '재등록 3회차']) : null,
        createdAt: kstAt(joinedAt, 10 * 60),
      });
      branchMembers.push({ id, status, joinedAt });
    }
    // 히어로 회원(활성)도 지난 회차 예약 이력에 섞는다 — 회원 웹 "지난 예약"이 비지 않게
    for (const hero of await prisma.member.findMany({ where: { branchId: b.id, status: 'ACTIVE' }, select: { id: true, joinedAt: true } })) {
      branchMembers.push({ id: hero.id, status: 'HERO', joinedAt: hero.joinedAt.toISOString().slice(0, 10) });
    }
    memberPoolByBranch.set(b.id, branchMembers);

    // ── 회차·예약·결제 ──
    const pastPool = branchMembers.filter((m) => m.status !== 'WITHDRAWN');
    const futurePool = branchMembers.filter((m) => m.status === 'ACTIVE');
    let slotNo = 0;
    const lastDay = addDays(win.end, win.future);
    for (const spec of slotSpecs) {
      for (let d = win.start; d <= lastDay; d = addDays(d, 1)) {
        if (!spec.days.includes(weekday(d))) continue;
        const future = d >= today;
        if (future && !spec.futureToo) continue;
        const slotId = `demo-slot-${key}-${++slotNo}`;
        slots.push({ id: slotId, programId: spec.programId, date: asDate(d), startTime: spec.start, endTime: spec.end, capacity: spec.capacity });
        const startAt = kstAt(d, toMinutes(spec.start));
        const fill = future ? rng.float() * 0.85 * Math.max(0.3, 1 - dayDiff(d, today) / FUTURE_DAYS) : 0.45 + rng.float() * 0.55;
        const candidates = (future ? futurePool : pastPool).filter((m) => m.joinedAt <= d);
        const chosen = rng.sample(candidates, Math.round(spec.capacity * fill));
        for (const m of chosen) {
          const rid = `demo-reservation-${key}-${slotNo}-${m.id.replace(/^demo-/, 'd')}`;
          const createdAt = notAfterNow(new Date(startAt.getTime() - rng.int(1, 10) * DAY_MS - rng.int(0, 600) * 60_000));
          let status: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED' | 'CONFIRMED' | 'REQUESTED';
          if (future) status = rng.chance(0.06) ? 'CANCELLED' : rng.chance(0.12) ? 'REQUESTED' : 'CONFIRMED';
          else status = rng.chance(0.1) ? 'CANCELLED' : rng.chance(0.07) ? 'NO_SHOW' : 'COMPLETED';
          const cancelledAt = status === 'CANCELLED' ? notAfterNow(new Date(createdAt.getTime() + rng.int(1, 48) * 3_600_000)) : null;
          reservations.push({ id: rid, memberId: m.id, scheduleSlotId: slotId, status, createdAt, cancelledAt, cancelReason: cancelledAt ? rng.pick(['개인 일정', '건강 문제', '일정 변경']) : null });
          if (spec.price > 0) {
            const approved = status !== 'REQUESTED' && !(status === 'CANCELLED' && rng.chance(0.3));
            const approvedAt = approved ? new Date(createdAt.getTime() + rng.int(1, 30) * 60_000) : null;
            payments.push({
              id: `demo-payment-${rid.replace(/^demo-reservation-/, '')}`,
              reservationId: rid,
              memberId: m.id,
              amount: spec.price,
              ...vat(spec.price),
              method: 'MOCK_CARD',
              status: status === 'REQUESTED' ? 'PENDING' : status === 'CANCELLED' ? (approved ? 'REFUNDED' : 'FAILED') : 'APPROVED',
              mockApprovalNo: approved ? `MOCK-${rng.hex(8)}` : null,
              approvedAt,
              refundedAt: status === 'CANCELLED' && approved ? cancelledAt : null,
              createdAt,
            });
          }
        }
      }
    }

    // ── 수강·PT ──
    const enrollable = branchMembers.filter((m) => m.status !== 'HERO' && m.status !== 'WITHDRAWN');
    for (const [ei, m] of rng.sample(enrollable, Math.round(enrollable.length * 0.4)).entries()) {
      const c = rng.pick(classPrograms);
      const enrolledAt = addDays(win.end, -rng.int(10, 80));
      const enrolledOk = enrolledAt >= m.joinedAt ? enrolledAt : m.joinedAt;
      enrollments.push({
        id: `demo-enrollment-${key}-${ei + 1}`,
        memberId: m.id,
        programId: c.id,
        enrolledAt: asDate(enrolledOk),
        expiresAt: asDate(addDays(enrolledOk, 90)),
        status: win.terminated ? 'CANCELLED' : addDays(enrolledOk, 90) < today ? 'COMPLETED' : 'ACTIVE',
      });
    }
    for (const [pi, m] of rng.sample(enrollable, Math.max(3, Math.round(enrollable.length * 0.15))).entries()) {
      const total = rng.pick([10, 20, 30]);
      const used = rng.int(0, Math.min(total, 12));
      const purchasedAt = addDays(win.end, -rng.int(used * 4 + 1, used * 4 + 30));
      const ptId = `demo-pt-${key}-${pi + 1}`;
      ptSessions.push({ id: ptId, memberId: m.id, programId: ptProgramId, totalSessions: total, usedSessions: used, purchasedAt: asDate(purchasedAt) });
      for (let u = 1; u <= used; u++) {
        ptLogs.push({ id: `${ptId}-log-${u}`, ptSessionId: ptId, usedAt: notAfterNow(kstAt(addDays(purchasedAt, u * 4), rng.int(9, 20) * 60)), note: rng.chance(0.3) ? rng.pick(['하체 위주', '자세 교정', '체성분 측정']) : null });
      }
    }

    // ── 자산 ──
    for (const [ai, a] of ASSET_POOL.entries()) {
      const [name, category, assetType, cost, life, location] = a;
      const acquired = addDays(today, -rng.int(60, 1500));
      const roll = rng.float();
      const status = win.terminated ? 'DISPOSAL_PENDING' : roll < 0.8 ? 'NORMAL' : roll < 0.9 ? 'REPAIRING' : roll < 0.95 ? 'DISPOSAL_PENDING' : 'DISPOSED';
      assets.push({
        id: `demo-asset-${key}-${ai + 1}`,
        assetCode: `${b.code}-A${pad(nextCode('ASSET', b.id, `${b.code}-A`), 3)}`,
        branchId: b.id,
        name,
        category,
        assetType,
        acquiredAt: asDate(acquired),
        acquisitionCost: cost,
        usefulLifeYears: assetType === 'FIXED_ASSET' ? life : null,
        status,
        quantity: assetType === 'FIXED_ASSET' ? 1 : rng.int(2, 40),
        location,
        note: status === 'REPAIRING' ? '수리 업체 방문 대기' : null,
      });
    }

    // ── 문서 ── 위탁운영 계약서(보존기한 필수, D28 CHECK)·직원 근로계약서
    documents.push({
      id: `demo-document-${key}-contract`,
      category: 'CONTRACT',
      branchId: b.id,
      title: `${b.name} 위탁운영 계약서`,
      fileUrl: `demo://documents/${key}/contract.pdf`,
      fileType: 'application/pdf',
      fileSize: rng.int(200_000, 900_000),
      uploadedBy: hq.id,
      retentionUntil: asDate(addDays(today, 365 * 5)),
      createdAt: kstAt(b.contractStartAt.toISOString().slice(0, 10), 11 * 60),
    });
    for (const s of branchStaff) {
      const st = staffRows.find((r) => r.id === s.id)!;
      documents.push({
        id: `demo-document-${s.id.replace(/^demo-staff-/, '')}-hr`,
        category: 'HR_RECORD',
        branchId: b.id,
        relatedStaffId: s.id,
        title: `${st.name} 근로계약서`,
        fileUrl: `demo://documents/${key}/${s.id}.pdf`,
        fileType: 'application/pdf',
        fileSize: rng.int(80_000, 300_000),
        uploadedBy: hq.id,
        createdAt: kstAt((st.hireDate as Date).toISOString().slice(0, 10), 10 * 60),
      });
    }

    // ── 지점 관리자 계정이 쓰는 것: 지점 게시글·업무지원 요청 ──
    const branchAdmin = await prisma.account.findFirst({
      where: { role: 'BRANCH_ADMIN', isActive: true, staff: { branchId: b.id } },
      orderBy: { id: 'asc' },
    });
    const authorId = branchAdmin?.id ?? hq.id;
    for (const [pi, p] of POST_TITLES_BRANCH.entries()) {
      const published = addDays(win.end, -Math.round(((pi + 0.5) * HISTORY_DAYS) / POST_TITLES_BRANCH.length));
      posts.push({
        id: `demo-post-${key}-${pi + 1}`,
        scope: 'BRANCH_TO_MEMBER',
        branchId: b.id,
        authorId,
        category: p[0],
        title: `[${b.name}] ${p[1]}`,
        content: p[2],
        pinned: pi === 0 && !win.terminated,
        visibleToMember: true,
        viewCount: rng.int(5, 180),
        publishedAt: asDate(published),
        createdAt: kstAt(published, 9 * 60 + pi),
      });
    }
    if (!win.terminated && branchAdmin) {
      for (const [si, s] of rng.sample(SUPPORT_POOL, rng.int(3, 5)).entries()) {
        const created = kstAt(addDays(today, -rng.int(1, 60)), rng.int(9 * 60, 18 * 60));
        const status = rng.pick(['REQUESTED', 'IN_PROGRESS', 'DONE', 'DONE', 'REJECTED'] as const);
        const resolved = status === 'DONE' || status === 'REJECTED' ? notAfterNow(new Date(created.getTime() + rng.int(1, 7) * DAY_MS)) : null;
        supports.push({
          id: `demo-support-${key}-${si + 1}`,
          branchId: b.id,
          requesterId: branchAdmin.id,
          category: s[0],
          title: s[1],
          content: s[2],
          status,
          handlerId: status === 'REQUESTED' ? null : hq.id,
          response: status === 'REJECTED' ? '이번 분기 예산 범위를 넘어 다음 분기에 다시 검토합니다.' : status === 'DONE' ? '처리했습니다.' : null,
          resolvedAt: resolved,
          createdAt: created,
          updatedAt: resolved ?? created,
        });
      }
    }

    // ── 혼잡도 스냅샷 — 운영 중 지점 시설의 최근 7일, 06~22시 매시 ──
    if (!win.terminated) {
      const branchFacilities = [...(baseGym ? [{ id: baseGym.id, capacity: baseGym.capacity }] : []), ...facilities.filter((f) => f.branchId === b.id).map((f) => ({ id: f.id!, capacity: f.capacity }))];
      for (const f of branchFacilities) {
        for (let d = addDays(today, -7); d < today; d = addDays(d, 1)) {
          for (let h = 6; h <= 22; h++) {
            const peak = h >= 18 && h <= 21 ? 0.75 : h >= 6 && h <= 8 ? 0.55 : 0.3;
            const current = Math.min(f.capacity, Math.round(f.capacity * (peak + (rng.float() - 0.5) * 0.3)));
            snapshots.push({ id: `demo-snapshot-${f.id}-${d}-${h}`, facilityId: f.id, currentCount: Math.max(0, current), capacity: f.capacity, level: congestionLevel(current, f.capacity), source: 'AUTO', recordedAt: kstAt(d, h * 60) });
          }
        }
      }
    }
  }

  // ── 본사 공지(전 지점) ──
  for (const [pi, p] of POST_TITLES_HQ.entries()) {
    const published = addDays(today, -Math.round(((pi + 0.5) * HISTORY_DAYS) / POST_TITLES_HQ.length));
    posts.push({
      id: `demo-post-hq-${pi + 1}`,
      scope: 'HQ_TO_BRANCH',
      branchId: null,
      authorId: hq.id,
      category: p[0],
      title: p[1],
      content: p[2],
      pinned: pi === 0,
      visibleToMember: false,
      viewCount: rng.int(20, 300),
      publishedAt: asDate(published),
      createdAt: kstAt(published, 9 * 60 + pi),
    });
  }

  // ── 근태·휴가·업무일지 — 기준 시드 직원(히어로 포함)과 새 직원 모두, 파견 이력의 지점으로(ADR-ATT-03 스냅샷) ──
  const baseStaff = await prisma.staff.findMany({ where: { status: 'ACTIVE' }, include: { assignments: true } });
  type StaffForAttendance = { id: string; key: string; hireDate: string; partTime: boolean; offDays: number[]; assignments: Array<{ branchId: string; start: string; end?: string }> };
  const allStaff: StaffForAttendance[] = [
    ...baseStaff
      .filter((s) => BRANCH_PLAN[s.branchId])
      .map((s) => ({
        id: s.id,
        key: s.id.replace(/^staff-/, ''),
        hireDate: s.hireDate.toISOString().slice(0, 10),
        partTime: s.employmentType === '파트타임',
        offDays: s.offDays,
        assignments: s.assignments.map((a) => ({ branchId: a.branchId, start: a.startDate.toISOString().slice(0, 10), end: a.endDate?.toISOString().slice(0, 10) })),
      })),
    ...staffRows.map((s) => ({
      id: s.id!,
      key: s.id!.replace(/^demo-staff-/, 'd'),
      hireDate: (s.hireDate as Date).toISOString().slice(0, 10),
      partTime: s.employmentType === '파트타임',
      offDays: (s.offDays as number[]) ?? [],
      assignments: assignments
        .filter((a) => a.staffId === s.id)
        .map((a) => ({ branchId: a.branchId, start: (a.startDate as Date).toISOString().slice(0, 10), end: a.endDate ? (a.endDate as Date).toISOString().slice(0, 10) : undefined })),
    })),
  ];
  const checkInTimeOf = new Map(branches.map((b) => [b.id, toMinutes(b.standardCheckInTime ?? '09:00')]));
  const monthStart = `${yesterday.slice(0, 7)}-01`;
  const approverOf = new Map<string, string>(); // 지점 → 휴가 승인자(지점 관리자 계정)
  for (const b of planned) {
    const admin = await prisma.account.findFirst({ where: { role: 'BRANCH_ADMIN', staff: { branchId: b.id } }, orderBy: { id: 'asc' } });
    if (admin) approverOf.set(b.id, admin.id);
  }
  for (const s of allStaff) {
    const branchOn = (d: string) => s.assignments.find((a) => a.start <= d && (!a.end || d <= a.end))?.branchId;
    const lastAssigned = s.assignments.reduce((max, a) => ((a.end ?? yesterday) > max ? (a.end ?? yesterday) : max), '');
    const end = lastAssigned < yesterday ? lastAssigned : yesterday;
    const start = addDays(end, -(HISTORY_DAYS - 1));

    // 휴가: 지난 승인 1~2건(1~2일), 반려 0~1건, 앞으로의 대기 0~1건
    const leaveDaysSet = new Set<string>();
    const approvedCount = rng.int(1, 2);
    for (let li = 0; li < approvedCount; li++) {
      const from = addDays(start, rng.int(5, HISTORY_DAYS - 10));
      const days = rng.int(1, 2);
      const branchId = branchOn(from);
      if (!branchId) continue;
      for (let k = 0; k < days; k++) leaveDaysSet.add(addDays(from, k));
      leaveRequests.push({ id: `demo-leave-${s.key}-${li + 1}`, staffId: s.id, type: rng.pick(['ANNUAL', 'ANNUAL', 'SICK', 'FAMILY_EVENT'] as const), startDate: asDate(from), endDate: asDate(addDays(from, days - 1)), days, reason: '개인 사유', status: 'APPROVED', approverId: approverOf.get(branchId) ?? null, reviewedAt: kstAt(addDays(from, -3), 14 * 60), createdAt: kstAt(addDays(from, -5), 10 * 60) });
    }
    if (rng.chance(0.4)) {
      const from = addDays(start, rng.int(5, HISTORY_DAYS - 5));
      leaveRequests.push({ id: `demo-leave-${s.key}-r`, staffId: s.id, type: 'ANNUAL', startDate: asDate(from), endDate: asDate(from), days: 1, reason: '개인 사유', status: 'REJECTED', approverId: approverOf.get(branchOn(from) ?? '') ?? null, reviewedAt: kstAt(addDays(from, -2), 15 * 60), createdAt: kstAt(addDays(from, -4), 10 * 60) });
    }
    if (end === yesterday && rng.chance(0.5)) {
      const from = addDays(today, rng.int(3, 20));
      leaveRequests.push({ id: `demo-leave-${s.key}-p`, staffId: s.id, type: 'ANNUAL', startDate: asDate(from), endDate: asDate(from), days: 1, reason: '가족 행사', status: 'PENDING', createdAt: notAfterNow(kstAt(addDays(today, -1), 11 * 60)) });
    }

    for (let d = start; d <= end; d = addDays(d, 1)) {
      const branchId = branchOn(d);
      if (!branchId || d < s.hireDate || leaveDaysSet.has(d)) continue;
      const works = s.partTime ? rng.chance(0.45) : !s.offDays.includes(weekday(d));
      if (!works) continue;
      const standard = checkInTimeOf.get(branchId) ?? 540;
      const roll = rng.float();
      if (roll < 0.015) {
        // 이번 달은 미확정 결근(결근 미리보기 후보, ADR-ATT-02), 지난 달은 확정된 결근 기록
        if (d < monthStart) attendance.push({ id: `demo-att-${s.key}-${d}`, staffId: s.id, branchId, date: asDate(d), status: 'ABSENT', note: '결근 확정', createdAt: kstAt(addDays(d, 1), 10 * 60) });
        continue;
      }
      let status: 'NORMAL' | 'LATE' | 'EARLY_LEAVE' = 'NORMAL';
      let inMin = standard - rng.int(0, 25);
      let outMin = inMin + 9 * 60 + rng.int(0, 40);
      if (roll < 0.075) {
        status = 'LATE';
        inMin = standard + rng.int(3, 40);
        outMin = inMin + 9 * 60;
      } else if (roll < 0.095) {
        status = 'EARLY_LEAVE';
        outMin = inMin + rng.int(4, 7) * 60;
      }
      if (s.partTime) outMin = inMin + rng.int(4, 6) * 60;
      attendance.push({ id: `demo-att-${s.key}-${d}`, staffId: s.id, branchId, date: asDate(d), checkInAt: kstAt(d, inMin), checkOutAt: kstAt(d, outMin), status, createdAt: kstAt(d, inMin) });
      if (rng.chance(0.6)) workLogs.push({ id: `demo-worklog-${s.key}-${d}`, staffId: s.id, date: asDate(d), content: rng.pick(WORK_LOG_LINES), createdAt: kstAt(d, outMin - 10) });
    }
  }
  // 연차 사용 일수 — 올해 승인된 연차만(근태관리 A-3)
  for (const lb of leaveBalances) {
    lb.usedDays = leaveRequests
      .filter((l) => l.staffId === lb.staffId && l.status === 'APPROVED' && l.type === 'ANNUAL' && (l.startDate as Date).getUTCFullYear() === year)
      .reduce((sum, l) => sum + (l.days as number), 0);
  }

  // ── 게시글 읽음·인사 변경 신청 ──
  const staffAccounts = staffRows.map((s) => s.accountId);
  for (const p of posts.filter((x) => x.scope === 'HQ_TO_BRANCH')) {
    for (const accountId of rng.sample(staffAccounts, Math.round(staffAccounts.length * (0.3 + rng.float() * 0.6)))) {
      receipts.push({ id: `${p.id}-read-${accountId.replace(/^demo-account-/, '')}`, postId: p.id!, accountId, readAt: notAfterNow(new Date((p.createdAt as Date).getTime() + rng.int(1, 72) * 3_600_000)) });
    }
  }
  for (const [ci, st] of rng.sample(staffRows.filter((s) => (s.branchId as string) !== 'branch-nowon'), 3).entries()) {
    changeRequests.push({ id: `demo-change-request-${ci + 1}`, staffId: st.id!, field: 'phone', oldValue: st.phone ?? null, newValue: phone(), status: 'PENDING', createdAt: notAfterNow(kstAt(addDays(today, -rng.int(1, 5)), 13 * 60)) });
  }

  // ── 쓰기 — 참조 순서대로. 한 트랜잭션이라 중간에 실패하면 아무것도 남지 않는다 ──
  await prisma.$transaction(
    async (tx) => {
      await insertMany('account', accounts, (c) => tx.account.createMany({ data: c }), counts);
      await insertMany('staff', staffRows, (c) => tx.staff.createMany({ data: c }), counts);
      await insertMany('staffAssignment', assignments, (c) => tx.staffAssignment.createMany({ data: c }), counts);
      await insertMany('leaveBalance', leaveBalances, (c) => tx.leaveBalance.createMany({ data: c }), counts);
      await insertMany('facility', facilities, (c) => tx.facility.createMany({ data: c }), counts);
      await insertMany('instructor', instructors, (c) => tx.instructor.createMany({ data: c }), counts);
      await insertMany('program', programs, (c) => tx.program.createMany({ data: c }), counts);
      await insertMany('programScheduleTemplate', templates, (c) => tx.programScheduleTemplate.createMany({ data: c }), counts);
      await insertMany('scheduleSlot', slots, (c) => tx.scheduleSlot.createMany({ data: c }), counts);
      await insertMany('member', members, (c) => tx.member.createMany({ data: c }), counts);
      await insertMany('reservation', reservations, (c) => tx.reservation.createMany({ data: c }), counts);
      await insertMany('payment', payments, (c) => tx.payment.createMany({ data: c }), counts);
      await insertMany('courseEnrollment', enrollments, (c) => tx.courseEnrollment.createMany({ data: c }), counts);
      await insertMany('ptSession', ptSessions, (c) => tx.pTSession.createMany({ data: c }), counts);
      await insertMany('ptSessionLog', ptLogs, (c) => tx.pTSessionLog.createMany({ data: c }), counts);
      await insertMany('post', posts, (c) => tx.post.createMany({ data: c }), counts);
      await insertMany('postReadReceipt', receipts, (c) => tx.postReadReceipt.createMany({ data: c }), counts);
      await insertMany('asset', assets, (c) => tx.asset.createMany({ data: c }), counts);
      await insertMany('document', documents, (c) => tx.document.createMany({ data: c }), counts);
      await insertMany('supportRequest', supports, (c) => tx.supportRequest.createMany({ data: c }), counts);
      await insertMany('congestionSnapshot', snapshots, (c) => tx.congestionSnapshot.createMany({ data: c }), counts);
      await insertMany('staffProfileChangeRequest', changeRequests, (c) => tx.staffProfileChangeRequest.createMany({ data: c }), counts);
      await insertMany('leaveRequest', leaveRequests, (c) => tx.leaveRequest.createMany({ data: c }), counts);
      await insertMany('attendanceRecord', attendance, (c) => tx.attendanceRecord.createMany({ data: c }), counts);
      await insertMany('workLog', workLogs, (c) => tx.workLog.createMany({ data: c }), counts);
      // 채번 시퀀스를 새 번호의 최대 순번으로(첫 앱 채번이 시드 번호와 충돌하지 않게, data-integrity §5)
      for (const s of seq.values()) {
        await tx.codeSequence.upsert({
          where: { branchId_kind_prefix: { branchId: s.branchId, kind: s.kind, prefix: s.prefix } },
          update: { lastValue: s.lastValue },
          create: { branchId: s.branchId, kind: s.kind, prefix: s.prefix, lastValue: s.lastValue },
        });
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
  return { today, counts };
}

// 혼잡도관리 A-6 5단계 매핑 — facility.service의 congestionLevel과 같은 구간
function congestionLevel(currentCount: number, capacity: number): number {
  const ratio = (currentCount / capacity) * 100;
  if (ratio <= 20) return 1;
  if (ratio <= 40) return 2;
  if (ratio <= 60) return 3;
  if (ratio <= 80) return 4;
  return 5;
}

// 근태관리 A-3 — 1년 미만 11일, 1년 이상 15일에서 2년마다 1일 가산(최대 25일). attendance.service와 같은 규칙.
function annualLeaveTotal(hireDate: string, year: number): number {
  const years = year - Number(hireDate.slice(0, 4));
  if (years < 1) return 11;
  return Math.min(15 + Math.floor((years - 1) / 2), 25);
}
