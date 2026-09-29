import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { addYearsToDateString, kstHoursMinutes, toKstDateString, todayKst } from '../common/date/kst-date';
import {
  AssetCategory,
  AssetStatus,
  AssetType,
  AttendanceStatus,
  DocumentCategory,
  LeaveType,
  MockAccount,
  MockAsset,
  MockDocument,
  MockAttendanceRecord,
  MockBranch,
  MockLeaveBalance,
  MockLeaveRequest,
  MockPost,
  MockStaff,
  MockStaffAssignment,
  MockWorkLog,
  PostScope,
  Role,
} from './mock-data.types';
import { generateLightBranches } from './branch-generator';
import { HERO_BRANCHES, toMockBranch } from './branch-fixtures';
import { BranchGate } from '../modules/branches/branch-gate';
import { AppException } from '../common/exceptions/app.exception';


// 데모 계정 공통 비밀번호. prisma/seed.ts의 DEMO_PASSWORD와 동일하게 맞춰서,
// 나중에 실제 DB로 전환해도 로그인 테스트 계정 정보가 바뀌지 않도록 합니다.
export const MOCK_DEMO_PASSWORD = 'demo-password-1234';

/**
 * Phase 1 스캐폴딩 단계의 인메모리 더미 데이터 저장소.
 * Docker/PostgreSQL 없이도 `npm run dev`만으로 전체 구조를 확인할 수 있도록,
 * PrismaService 대신 이 서비스가 임시로 데이터 소스 역할을 합니다.
 * 실제 기능 구현 단계에서는 이 서비스를 Prisma 기반 리포지토리로 교체합니다.
 */
@Injectable()
export class MockDataService {
  // 원본 RFP가 명시하는 "전국 98개 업장" 규모를 화면에서 실제로 검증하기 위한 생성 데이터.
  // 서초점·강남점 2개는 아래처럼 손으로 채운 "히어로" 지점(데모 로그인 계정이 여기 물려 있음)이고,
  // 나머지 96개는 branch-generator.ts가 인덱스 기반으로 결정적으로 만든다.
  private readonly generated = generateLightBranches();

  // D29 — 이름표 사본(계약 필드 없음). 원천은 DB이고 시드와 같은 목록(branch-fixtures.ts)에서 만든다.
  readonly branches: MockBranch[] = [...HERO_BRANCHES, ...this.generated.branches].map(toMockBranch);

  // D30 — 관리자·직원 계정은 DB가 원천이고 여기에는 앱이 뜰 때 채우는 미러(StaffService)가 들어온다.
  // D32 — 회원 계정도 DB로 옮겨져 mock이 원천인 계정은 없다. 게시판·문서가 작성자 이름을 읽는 용도로만 남는다.
  readonly accounts: MockAccount[] = [];

  // D30 — 직원·파견의 원천은 DB다. 이 두 배열은 아직 mock인 근태·문서·게시판이 동기적으로 읽는 미러로,
  // StaffService가 앱이 뜰 때 DB 전체로 채우고 직원 쓰기 뒤 해당 직원만 갱신한다(replace/upsertStaffMirror).
  // D31의 시설·강사·프로그램·회차 미러는 D32로 독자(예약·회원)가 DB로 옮겨져 없앴다.
  readonly staff: MockStaff[] = [];
  readonly staffAssignments: MockStaffAssignment[] = [];

  // 1-10문서 §4 — 서초점 데모 자산. 러닝머신은 100만원 초과라 FIXED_ASSET, 소독제는 CONSUMABLE.
  readonly assets: MockAsset[] = [
    {
      id: 'asset-seocho-treadmill',
      assetCode: 'SEOCHO-A001',
      branchId: 'branch-seocho',
      name: '러닝머신',
      category: 'EXERCISE_EQUIPMENT',
      assetType: 'FIXED_ASSET',
      acquiredAt: '2025-03-10',
      acquisitionCost: 3200000,
      usefulLifeYears: 5,
      status: 'NORMAL',
      quantity: 1,
      location: '2층 헬스장',
    },
    {
      id: 'asset-seocho-aed',
      assetCode: 'SEOCHO-A002',
      branchId: 'branch-seocho',
      name: '자동제세동기(AED)',
      category: 'SAFETY_EQUIPMENT',
      assetType: 'FIXED_ASSET',
      acquiredAt: '2025-06-01',
      acquisitionCost: 1800000,
      usefulLifeYears: 5,
      status: 'REPAIRING',
      quantity: 1,
      location: '1층 로비',
    },
    {
      id: 'asset-seocho-sanitizer',
      assetCode: 'SEOCHO-A003',
      branchId: 'branch-seocho',
      name: '손소독제',
      category: 'OTHER',
      assetType: 'CONSUMABLE',
      acquiredAt: '2026-08-01',
      acquisitionCost: 45000,
      status: 'NORMAL',
      quantity: 12,
    },
  ];

  // 1-10문서 §5 — 전사 매뉴얼(영구 보관) + 서초점 위탁계약서(수동 보존기한, 임박 목록 시연용).
  readonly documents: MockDocument[] = [
    {
      id: 'doc-hq-manual',
      category: 'MANUAL',
      title: 'ERP 이용자 매뉴얼 v1',
      fileUrl: 'https://files.example/spoism/erp-manual-v1.pdf',
      fileType: 'pdf',
      fileSize: 2048000,
      uploadedBy: 'account-haneul',
      createdAt: '2026-08-20T09:00:00.000Z',
    },
    {
      id: 'doc-seocho-contract',
      category: 'CONTRACT',
      branchId: 'branch-seocho',
      title: '서초점 위탁운영계약서',
      fileUrl: 'https://files.example/spoism/seocho-contract.pdf',
      fileType: 'pdf',
      fileSize: 1024000,
      uploadedBy: 'account-haneul',
      retentionUntil: '2026-10-05',
      createdAt: '2026-01-05T09:00:00.000Z',
    },
  ];

  readonly posts: MockPost[] = [
    {
      id: 'post-hq-manual',
      scope: 'HQ_TO_BRANCH',
      authorId: 'account-haneul',
      category: 'TRAINING_MATERIAL',
      title: 'ERP 시스템 사용 매뉴얼 안내',
      content: '전 지점 팀장급 직원 대상 ERP 사용법 매뉴얼을 게시판에 업로드했습니다.',
      viewCount: 0,
      publishedAt: '2026-08-20',
      visibleToMember: false,
    },
    {
      id: 'post-seocho-event',
      scope: 'BRANCH_TO_MEMBER',
      branchId: 'branch-seocho',
      authorId: 'account-minsu',
      category: 'EVENT',
      title: '9월 아침 요가 이벤트 안내',
      content: '9월 한 달간 아침 요가 신규 회원 20% 할인 이벤트를 진행합니다.',
      viewCount: 0,
      publishedAt: '2026-08-28',
      visibleToMember: true,
    },
  ];


  findAccountById(id: string): MockAccount | undefined {
    return this.accounts.find((a) => a.id === id);
  }


  findBranchById(id: string): MockBranch | undefined {
    return this.branches.find((b) => b.id === id);
  }




  findPostById(id: string): MockPost | undefined {
    return this.posts.find((p) => p.id === id && !p.deletedAt);
  }

  // 04문서 §5 POST /posts — SUPER_ADMIN은 HQ_TO_BRANCH(전체공지 또는 특정 지점 지정 가능),
  // BRANCH_ADMIN은 BRANCH_TO_MEMBER만 작성 가능하고 scope·branchId는 서버가 본인 지점으로 강제한다.
  createPost(
    author: { accountId: string; role: Role; branchId?: string },
    input: {
      title: string;
      content: string;
      category: MockPost['category'];
      branchId?: string;
      visibleToMember?: boolean;
    },
    gate: BranchGate,
  ): MockPost {
    let scope: PostScope;
    let branchId: string | undefined;

    if (author.role === 'SUPER_ADMIN') {
      scope = 'HQ_TO_BRANCH';
      branchId = input.branchId;
      if (branchId && !this.findBranchById(branchId)) {
        throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
      }
    } else {
      if (!author.branchId) {
        throw new AppException('BRANCH_REQUIRED', '소속 지점이 없는 계정입니다.', 403);
      }
      if (gate.isTerminated(author.branchId)) {
        throw new AppException(
          'BRANCH_TERMINATED',
          '위탁계약이 종료된 지점에서는 새 게시글을 작성할 수 없습니다.',
          409,
        );
      }
      scope = 'BRANCH_TO_MEMBER';
      branchId = author.branchId;
    }

    const post: MockPost = {
      id: `post-${randomUUID()}`,
      scope,
      branchId,
      authorId: author.accountId,
      category: input.category,
      title: input.title,
      content: input.content,
      viewCount: 0,
      publishedAt: todayKst(),
      // ADR-BRD-01 — BRANCH_TO_MEMBER는 scope로 이미 회원에게 노출되므로 항상 true.
      // HQ_TO_BRANCH는 작성자(SUPER_ADMIN)가 명시하지 않으면 기본 false(안전 측 우선).
      visibleToMember: scope === 'BRANCH_TO_MEMBER' ? true : (input.visibleToMember ?? false),
    };
    this.posts.push(post);
    return post;
  }

  // 04문서 §5 PATCH /posts/:id — 작성자 본인만 수정 가능(컨트롤러에서 authorId 검사).
  updatePost(id: string, input: Partial<Pick<MockPost, 'title' | 'content' | 'category'>>): MockPost {
    const post = this.findPostById(id);
    if (!post) {
      throw new AppException('POST_NOT_FOUND', '게시글을 찾을 수 없습니다.', 404);
    }
    if (input.title !== undefined) post.title = input.title;
    if (input.content !== undefined) post.content = input.content;
    if (input.category !== undefined) post.category = input.category;
    return post;
  }

  // 04문서 §6 — 물리 삭제 대신 deletedAt으로 소프트 삭제.
  deletePost(id: string): void {
    const post = this.findPostById(id);
    if (!post) {
      throw new AppException('POST_NOT_FOUND', '게시글을 찾을 수 없습니다.', 404);
    }
    post.deletedAt = new Date().toISOString();
  }

  incrementPostView(id: string): MockPost {
    const post = this.findPostById(id);
    if (!post) {
      throw new AppException('POST_NOT_FOUND', '게시글을 찾을 수 없습니다.', 404);
    }
    post.viewCount += 1;
    return post;
  }

  findStaffById(id: string): MockStaff | undefined {
    return this.staff.find((s) => s.id === id);
  }

  // ── D30 직원 미러 — StaffService만 쓴다(원천은 DB) ─────────────────────────────

  /** 앱이 뜰 때 DB 전체로 미러를 채운다. 배열 참조는 유지한다(readonly 필드를 다른 코드가 붙잡고 있을 수 있음). */
  replaceStaffMirror(data: { staff: MockStaff[]; assignments: MockStaffAssignment[]; accounts: MockAccount[] }): void {
    this.staff.splice(0, this.staff.length, ...data.staff);
    this.staffAssignments.splice(0, this.staffAssignments.length, ...data.assignments);
    const memberAccounts = this.accounts.filter((a) => a.role === 'MEMBER');
    this.accounts.splice(0, this.accounts.length, ...data.accounts, ...memberAccounts);
  }

  /** 직원 쓰기가 커밋된 뒤 그 직원 한 명(직원·파견 이력 전체·계정)을 교체한다. */
  upsertStaffMirror(data: { staff: MockStaff; assignments: MockStaffAssignment[]; account: MockAccount }): void {
    const replace = <T extends { id: string }>(arr: T[], item: T) => {
      const i = arr.findIndex((x) => x.id === item.id);
      if (i >= 0) arr[i] = item;
      else arr.push(item);
    };
    replace(this.staff, data.staff);
    replace(this.accounts, data.account);
    for (let i = this.staffAssignments.length - 1; i >= 0; i--) {
      if (this.staffAssignments[i].staffId === data.staff.id) this.staffAssignments.splice(i, 1);
    }
    this.staffAssignments.push(...data.assignments);
  }


  // ADR-RES-02 — 재직 중 업로드된 HR_RECORD 문서는 업로드 시점의 임시값(업로드일+3년)으로 보존기한이 고정돼 있었다.
  // 법정 기산일(근로관계 종료일)이 확정되는 퇴사 시점에 퇴사일+3년으로 다시 계산한다. 문서의 원천은 아직 mock이라
  // StaffService.resign이 DB 커밋 뒤 부른다(D30 결정 3).
  recalculateHrRetention(staffId: string, resignDate: string): void {
    const retentionUntil = this.addYears(resignDate, 3);
    this.documents
      .filter((d) => d.category === 'HR_RECORD' && d.relatedStaffId === staffId && !d.deletedAt)
      .forEach((d) => {
        d.retentionUntil = retentionUntil;
      });
  }

  // ── 03. 근태관리 ──────────────────────────────────────────────────────────

  readonly attendanceRecords: MockAttendanceRecord[] = [];
  readonly leaveRequests: MockLeaveRequest[] = [];
  readonly leaveBalances: MockLeaveBalance[] = [];
  readonly workLogs: MockWorkLog[] = [];

  // ADR-ATT-03(domains/근태관리.md) — 특정 과거 날짜에 그 직원이 소속돼 있던 지점을 파견 이력에서
  // 조회한다. endDate를 배타적(exclusive)으로 다룬다 — 파견 전환 당일은 새 지점 소속으로 본다
  // (assignStaff가 그날 Staff.branchId를 즉시 갱신하는 것과 같은 "즉시 반영" 원칙, ADR-AUTH-01).
  // 일치하는 파견 이력이 없으면(데이터 이상) 현재 소속으로 보수적으로 대체한다.
  private branchIdForStaffOnDate(staffId: string, date: string): string | undefined {
    const match = this.staffAssignments
      .filter((a) => a.staffId === staffId && a.startDate <= date && (!a.endDate || date < a.endDate))
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    return match?.branchId ?? this.staff.find((s) => s.id === staffId)?.branchId;
  }

  // 03문서 §6 "자동 지각 판정" — Branch.standardCheckInTime 대비 10분 초과 시 LATE.
  // 체크인 중복 방지(§6): staffId+date로 이미 checkInAt이 있으면 409.
  checkIn(staffId: string): MockAttendanceRecord {
    const staff = this.staff.find((s) => s.id === staffId);
    if (!staff) {
      throw new AppException('STAFF_NOT_FOUND', '직원을 찾을 수 없습니다.', 404);
    }
    const today = new Date();
    const date = todayKst();
    if (this.attendanceRecords.some((r) => r.staffId === staffId && r.date === date && r.checkInAt)) {
      throw new AppException('ALREADY_CHECKED_IN', '오늘 이미 체크인했습니다.', 409);
    }

    const branch = this.findBranchById(staff.branchId);
    const status: AttendanceStatus = this.isLate(today, branch?.standardCheckInTime) ? 'LATE' : 'NORMAL';
    // 오늘 체크인이므로 항상 "현재" 소속 지점이 맞다 — 그래도 branchIdForStaffOnDate로 통일해
    // confirmAbsences와 같은 경로를 타게 한다(호출부가 둘로 갈리면 나중에 또 어긋나기 쉽다).
    const branchId = this.branchIdForStaffOnDate(staffId, date) ?? staff.branchId;

    let record = this.attendanceRecords.find((r) => r.staffId === staffId && r.date === date);
    if (record) {
      record.checkInAt = today.toISOString();
      record.status = status;
      record.branchId = branchId;
    } else {
      record = {
        id: `attendance-${randomUUID()}`,
        staffId,
        branchId,
        date,
        checkInAt: today.toISOString(),
        status,
      };
      this.attendanceRecords.push(record);
    }
    return record;
  }

  checkOut(staffId: string): MockAttendanceRecord {
    const date = todayKst();
    const record = this.attendanceRecords.find((r) => r.staffId === staffId && r.date === date);
    if (!record || !record.checkInAt) {
      throw new AppException('NOT_CHECKED_IN', '오늘 체크인 기록이 없습니다.', 400);
    }
    if (record.checkOutAt) {
      throw new AppException('ALREADY_CHECKED_OUT', '오늘 이미 체크아웃했습니다.', 409);
    }
    record.checkOutAt = new Date().toISOString();
    return record;
  }

  // 지점 출근 기준시각(HH:mm) 대비 10분 초과 여부. 지점에 기준시각이 없으면 지각 판정 자체를 하지 않는다.
  // KST 시:분으로 비교한다(서버 프로세스의 로컬 시간대에 의존하던 setHours()는 date-time-handling.md와
  // 같은 이유로 제거 — 배포 환경의 시간대 설정과 무관하게 항상 정확해야 한다).
  private isLate(checkInAt: Date, standardCheckInTime?: string): boolean {
    if (!standardCheckInTime) return false;
    const [h, m] = standardCheckInTime.split(':').map(Number);
    const { hours, minutes } = kstHoursMinutes(checkInAt);
    return hours * 60 + minutes > h * 60 + m + 10;
  }

  // 03문서 §5 GET /attendance/summary — 지점 근태 요약(상태별 집계). month는 "YYYY-MM".
  // ADR-ATT-03 — 집계 기준은 "현재 이 지점 소속 직원"이 아니라 "그 기록 자체의 branchId"다.
  // 월중 파견 이동이 있었다면, 이동 전 기록은 예전 지점 요약에, 이동 후 기록은 새 지점 요약에 각각
  // 정확히 잡힌다(소급 왜곡 없음). 표에 뜨는 직원 명단도 "현재 이 지점 소속"과 "이 달에 이 지점
  // 기록이 있는 사람"의 합집합이라, 월중 전출한 직원도 전출 전 기록만큼은 여기 남는다.
  attendanceSummary(branchId: string, month: string) {
    const records = this.attendanceRecords.filter((r) => r.branchId === branchId && r.date.startsWith(month));
    const staffIds = new Set(this.staff.filter((s) => s.branchId === branchId).map((s) => s.id));
    for (const r of records) staffIds.add(r.staffId);

    return Array.from(staffIds).map((staffId) => {
      const own = records.filter((r) => r.staffId === staffId);
      return {
        staffId,
        name: this.findStaffById(staffId)?.name ?? '(알 수 없음)',
        normal: own.filter((r) => r.status === 'NORMAL').length,
        late: own.filter((r) => r.status === 'LATE').length,
        absent: own.filter((r) => r.status === 'ABSENT').length,
        earlyLeave: own.filter((r) => r.status === 'EARLY_LEAVE').length,
        onLeave: own.filter((r) => r.status === 'ON_LEAVE').length,
      };
    });
  }

  // ADR-ATT-02(domains/근태관리.md) — 오늘이 그 직원의 근무일인지 판정.
  // 파트타임은 근무일이 주 단위로 고정되지 않아 이 판정 자체를 하지 않는다(03문서 §3).
  private isWorkDay(staff: MockStaff, dateStr: string): boolean {
    if (staff.employmentType === '파트타임') return false;
    const dayOfWeek = new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0=일~6=토, UTC 고정 파싱이라 호스트 시간대 무관
    return !(staff.offDays ?? []).includes(dayOfWeek);
  }

  // ADR-ATT-02 — "잠정 결근" 미리보기: 스케줄러 없이 조회 시점에 계산만 하고 저장하지 않는다.
  // 대상: ①재직 중 ②오늘 이전 과거 날짜 ③**그 날짜 기준 이 지점 소속**(ADR-ATT-03, branchIdForStaffOnDate —
  // 현재 소속이 아니라 그날 당시 소속으로 판정. 월중 파견 이동으로 다른 지점 후보에서 빠지지 않도록,
  // 후보 직원 명단도 "현재 이 지점" + "이 지점 파견 이력이 있는 사람"의 합집합으로 잡는다) ④근무일
  // (파트타임 제외, isWorkDay) ⑤근태기록 없음 ⑥승인된 휴가 기간이 아님. confirmAbsences를 호출해야만
  // 실제로 저장된다.
  previewAbsences(branchId: string, month: string): Array<{ staffId: string; name: string; date: string }> {
    const candidateIds = new Set<string>(this.staff.filter((s) => s.branchId === branchId).map((s) => s.id));
    for (const a of this.staffAssignments) {
      if (a.branchId === branchId) candidateIds.add(a.staffId);
    }
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const todayStr = todayKst();
    const result: Array<{ staffId: string; name: string; date: string }> = [];

    for (const staffId of candidateIds) {
      const staff = this.staff.find((s) => s.id === staffId);
      if (!staff || staff.status !== 'ACTIVE') continue;
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${month}-${String(day).padStart(2, '0')}`;
        if (dateStr >= todayStr) continue; // 오늘·미래는 아직 판단하지 않는다
        if (this.branchIdForStaffOnDate(staffId, dateStr) !== branchId) continue; // 그날은 이 지점 소속이 아니었음
        if (!this.isWorkDay(staff, dateStr)) continue;
        const hasRecord = this.attendanceRecords.some((r) => r.staffId === staffId && r.date === dateStr);
        if (hasRecord) continue;
        const hasApprovedLeave = this.leaveRequests.some(
          (r) => r.staffId === staffId && r.status === 'APPROVED' && r.startDate <= dateStr && dateStr <= r.endDate,
        );
        if (hasApprovedLeave) continue;
        result.push({ staffId, name: staff.name, date: dateStr });
      }
    }
    return result;
  }

  // ADR-ATT-02 — 결근 확정(BRANCH_ADMIN 명시적 액션, 컨트롤러에서 role 강제). previewAbsences가 이미
  // "근태기록 없음"을 조건으로 걸러 두므로, 확정된 날짜는 다음 호출의 미리보기에서 자연히 빠진다(멱등).
  // branchId는 호출 시 넘긴 값을 그대로 쓴다 — previewAbsences가 이미 그 날짜 기준 이 지점 소속인
  // 후보만 돌려주므로(ADR-ATT-03) 다시 조회할 필요가 없다.
  confirmAbsences(branchId: string, month: string, note?: string): MockAttendanceRecord[] {
    const candidates = this.previewAbsences(branchId, month);
    const created: MockAttendanceRecord[] = candidates.map((c) => ({
      id: `attendance-${randomUUID()}`,
      staffId: c.staffId,
      branchId,
      date: c.date,
      status: 'ABSENT' as AttendanceStatus,
      note: note ?? '결근 확정(관리자 확인)',
    }));
    this.attendanceRecords.push(...created);
    return created;
  }

  // 03문서 §3 "입사연차 기준 자동계산" — 근로기준법 원칙의 단순화: 1년 미만은 11일,
  // 1년 이상은 15일에서 시작해 2년마다 1일 가산(최대 25일). 정밀한 월별 개근 판정은 범위 밖.
  private calcAnnualLeaveTotalDays(hireDate: string, asOfYear: number): number {
    const hire = new Date(hireDate);
    const yearsOfService = asOfYear - hire.getFullYear();
    if (yearsOfService < 1) return 11;
    return Math.min(15 + Math.floor((yearsOfService - 1) / 2), 25);
  }

  // year를 안 주면 올해 기준. 해당 연도 레코드가 아직 없으면 그 자리에서 계산해 생성한다(지연 생성).
  leaveBalance(staffId: string, year?: number): MockLeaveBalance {
    const targetYear = year ?? new Date().getFullYear();
    let balance = this.leaveBalances.find((b) => b.staffId === staffId && b.year === targetYear);
    if (!balance) {
      const staff = this.staff.find((s) => s.id === staffId);
      if (!staff) {
        throw new AppException('STAFF_NOT_FOUND', '직원을 찾을 수 없습니다.', 404);
      }
      balance = {
        staffId,
        year: targetYear,
        totalDays: this.calcAnnualLeaveTotalDays(staff.hireDate, targetYear),
        usedDays: 0,
      };
      this.leaveBalances.push(balance);
    }
    return balance;
  }

  // 03문서 §6 "연차 일수 계산" — 종료일 포함(inclusive), 주말 제외는 Phase 2.
  private calcLeaveDays(startDate: string, endDate: string): number {
    const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.floor(ms / 86_400_000) + 1;
  }

  // 03문서 §6 — 잔여일수 초과 신청도 막지 않고 경고만 반환(마이너스 연차를 관리자 재량으로 승인하는 실무 반영).
  requestLeave(
    staffId: string,
    input: { type: LeaveType; startDate: string; endDate: string; reason?: string },
  ): { request: MockLeaveRequest; warning?: string } {
    const days = this.calcLeaveDays(input.startDate, input.endDate);
    if (days <= 0) {
      throw new AppException('INVALID_DATE_RANGE', '종료일은 시작일 이후여야 합니다.', 400);
    }

    let warning: string | undefined;
    if (input.type === 'ANNUAL') {
      const balance = this.leaveBalance(staffId);
      if (balance.totalDays - balance.usedDays < days) {
        warning = '잔여 연차보다 많은 일수를 신청했습니다. 관리자 재량으로 승인될 수 있습니다.';
      }
    }

    const request: MockLeaveRequest = {
      id: `leave-${randomUUID()}`,
      staffId,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      days,
      reason: input.reason,
      status: 'PENDING',
    };
    this.leaveRequests.push(request);
    return { request, warning };
  }

  private findLeaveRequestOrThrow(id: string): MockLeaveRequest {
    const request = this.leaveRequests.find((r) => r.id === id);
    if (!request) {
      throw new AppException('LEAVE_REQUEST_NOT_FOUND', '휴가 신청을 찾을 수 없습니다.', 404);
    }
    return request;
  }

  // 03문서 §6 — 승인 시점에만 차감(신청만으로는 차감 안 함 → 반려 시 복구 로직 불필요).
  // type=ANNUAL(연차)만 LeaveBalance.usedDays에 반영, SICK/FAMILY_EVENT/OTHER는 이력만 남긴다.
  approveLeaveRequest(id: string, approverId: string): MockLeaveRequest {
    const request = this.findLeaveRequestOrThrow(id);
    if (request.status !== 'PENDING') {
      throw new AppException('LEAVE_REQUEST_ALREADY_REVIEWED', '이미 처리된 휴가 신청입니다.', 409);
    }
    request.status = 'APPROVED';
    request.approverId = approverId;
    request.reviewedAt = new Date().toISOString();

    if (request.type === 'ANNUAL') {
      const balance = this.leaveBalance(request.staffId);
      balance.usedDays += request.days;
    }
    return request;
  }

  rejectLeaveRequest(id: string, approverId: string): MockLeaveRequest {
    const request = this.findLeaveRequestOrThrow(id);
    if (request.status !== 'PENDING') {
      throw new AppException('LEAVE_REQUEST_ALREADY_REVIEWED', '이미 처리된 휴가 신청입니다.', 409);
    }
    request.status = 'REJECTED';
    request.approverId = approverId;
    request.reviewedAt = new Date().toISOString();
    return request;
  }

  // staffId+date 하루 1건 권장(§3) — 같은 날 다시 작성하면 새 글을 추가하지 않고 내용을 덮어쓴다.
  upsertWorkLog(staffId: string, date: string, content: string): MockWorkLog {
    let log = this.workLogs.find((l) => l.staffId === staffId && l.date === date);
    if (log) {
      log.content = content;
    } else {
      log = { id: `worklog-${randomUUID()}`, staffId, date, content, createdAt: new Date().toISOString() };
      this.workLogs.push(log);
    }
    return log;
  }


  findAssetById(id: string): MockAsset | undefined {
    return this.assets.find((a) => a.id === id);
  }

  // 1-10문서 §4-6 — 취득가액 100만원 초과면 고정자산, 이하면 소모품(세법상 즉시비용 처리 기준).
  private classifyAssetType(acquisitionCost: number): AssetType {
    return acquisitionCost > 1_000_000 ? 'FIXED_ASSET' : 'CONSUMABLE';
  }

  // `{지점코드}-A{순번}` — 폐기된 자산도 순번을 계속 차지하므로(재사용 안 함) 접두사로 시작하는 전체 개수 기준.
  private generateAssetCode(branchId: string): string {
    const code = this.findBranchById(branchId)?.code ?? 'BR';
    const seq = this.assets.filter((a) => a.assetCode.startsWith(`${code}-A`)).length + 1;
    return `${code}-A${String(seq).padStart(3, '0')}`;
  }

  // 1-10문서 §5 POST /assets — 권한·지점 강제는 컨트롤러에서 한다.
  // ADR-RES-01 — 계약종료(TERMINATED) 지점의 신규 자산 등록 차단. 자산은 SUPER_ADMIN도 직접 만들 수 있어
  // 역할 분기 없이 대상 branchId만으로 판정한다(BRANCH_ADMIN 한정인 createFacility 등과 다른 점).
  createAsset(input: {
    branchId: string;
    name: string;
    category: AssetCategory;
    acquiredAt: string;
    acquisitionCost: number;
    assetType?: AssetType;
    usefulLifeYears?: number;
    quantity?: number;
    location?: string;
    note?: string;
  }, gate: BranchGate): MockAsset {
    const branch = this.findBranchById(input.branchId);
    if (!branch) {
      throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
    }
    if (gate.isTerminated(input.branchId)) {
      throw new AppException(
        'BRANCH_TERMINATED',
        '위탁계약이 종료된 지점에는 새 자산을 등록할 수 없습니다.',
        409,
      );
    }
    // 자동 판정 결과를 관리자가 수동으로 덮어쓸 수 있다(고가 소모품을 고정자산 취급하는 경우 등).
    const assetType = input.assetType ?? this.classifyAssetType(input.acquisitionCost);
    const asset: MockAsset = {
      id: `asset-${randomUUID()}`,
      assetCode: this.generateAssetCode(input.branchId),
      branchId: input.branchId,
      name: input.name,
      category: input.category,
      assetType,
      acquiredAt: input.acquiredAt,
      acquisitionCost: input.acquisitionCost,
      usefulLifeYears: assetType === 'FIXED_ASSET' ? input.usefulLifeYears : undefined,
      status: 'NORMAL',
      quantity: assetType === 'FIXED_ASSET' ? 1 : (input.quantity ?? 1),
      location: input.location,
      note: input.note,
    };
    this.assets.push(asset);
    return asset;
  }

  // 상태·위치·수량·메모만 수정 — 상태 전이는 변경 이력 추적을 위해 별도 메서드로 분리(§5).
  updateAsset(
    id: string,
    input: Partial<{ name: string; location: string; quantity: number; note: string; usefulLifeYears: number }>,
  ): MockAsset {
    const asset = this.findAssetById(id);
    if (!asset) {
      throw new AppException('ASSET_NOT_FOUND', '자산을 찾을 수 없습니다.', 404);
    }
    if (input.name !== undefined) asset.name = input.name;
    if (input.location !== undefined) asset.location = input.location || undefined;
    if (input.note !== undefined) asset.note = input.note || undefined;
    if (input.usefulLifeYears !== undefined && asset.assetType === 'FIXED_ASSET') {
      asset.usefulLifeYears = input.usefulLifeYears;
    }
    if (input.quantity !== undefined) {
      if (asset.assetType === 'FIXED_ASSET' && input.quantity !== 1) {
        throw new AppException('INVALID_QUANTITY', '고정자산은 개체 단위 관리라 수량이 항상 1입니다.', 400);
      }
      asset.quantity = input.quantity;
    }
    return asset;
  }

  // 1-10문서 §4-4 "정상→수리중→폐기대상→폐기됨". 되돌림(수리 완료·폐기 보류)은 실무상 필요해 허용하되
  // 폐기됨은 종결 상태로 둔다 — 문서가 역방향 전이를 명시하지 않아 이 해석은 구현 시점의 판단이다.
  private static readonly ASSET_STATUS_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
    NORMAL: ['REPAIRING', 'DISPOSAL_PENDING'],
    REPAIRING: ['NORMAL', 'DISPOSAL_PENDING'],
    DISPOSAL_PENDING: ['NORMAL', 'DISPOSED'],
    DISPOSED: [],
  };

  updateAssetStatus(id: string, status: AssetStatus): MockAsset {
    const asset = this.findAssetById(id);
    if (!asset) {
      throw new AppException('ASSET_NOT_FOUND', '자산을 찾을 수 없습니다.', 404);
    }
    if (!MockDataService.ASSET_STATUS_TRANSITIONS[asset.status].includes(status)) {
      throw new AppException(
        'INVALID_STATUS_TRANSITION',
        `${asset.status} 상태에서 ${status}(으)로 전이할 수 없습니다.`,
        409,
      );
    }
    asset.status = status;
    return asset;
  }

  findDocumentById(id: string): MockDocument | undefined {
    return this.documents.find((d) => d.id === id && !d.deletedAt);
  }

  private addYears(date: string, years: number): string {
    return addYearsToDateString(date, years);
  }

  // 1-10문서 §5-6 — HR_RECORD는 근로관계 종료일(없으면 업로드일)+3년, CONTRACT는 관리자 직접 입력
  // (계약 유형마다 법정 기간이 달라 일괄 자동계산 안 함), MANUAL/OTHER는 영구 보관(null).
  private computeRetentionUntil(
    category: DocumentCategory,
    relatedStaffId: string | undefined,
    manualRetentionUntil: string | undefined,
  ): string | undefined {
    if (category === 'CONTRACT') return manualRetentionUntil;
    if (category === 'HR_RECORD') {
      const staff = relatedStaffId ? this.findStaffById(relatedStaffId) : undefined;
      const base = staff?.resignDate ?? todayKst();
      return this.addYears(base, 3);
    }
    return undefined;
  }

  // 1-10문서 §5 POST /documents — 권한·지점 강제는 컨트롤러에서 한다.
  // ADR-RES-01 — 계약종료(TERMINATED) 지점의 신규 문서 업로드 차단. branchId=null(전사 문서)은
  // 특정 지점 계약 상태와 무관하므로 대상 아님.
  createDocument(
    uploadedBy: string,
    input: {
      category: DocumentCategory;
      branchId?: string;
      relatedStaffId?: string;
      title: string;
      fileUrl: string;
      fileType?: string;
      fileSize?: number;
      retentionUntil?: string;
    },
    gate: BranchGate,
  ): MockDocument {
    if (input.branchId) {
      const branch = this.findBranchById(input.branchId);
      if (!branch) {
        throw new AppException('BRANCH_NOT_FOUND', '지점을 찾을 수 없습니다.', 404);
      }
      if (gate.isTerminated(input.branchId)) {
        throw new AppException(
          'BRANCH_TERMINATED',
          '위탁계약이 종료된 지점에는 새 문서를 등록할 수 없습니다.',
          409,
        );
      }
    }
    if (input.category === 'HR_RECORD') {
      if (!input.relatedStaffId) {
        throw new AppException('STAFF_REQUIRED', '인사서류는 대상 직원을 지정해야 합니다.', 400);
      }
      if (!this.findStaffById(input.relatedStaffId)) {
        throw new AppException('STAFF_NOT_FOUND', '직원을 찾을 수 없습니다.', 404);
      }
    }
    // ADR-RES-03 — CONTRACT는 자동계산이 없어(§5-6) 미입력을 허용하면 조용히 "영구 보관" 취급되어
    // retention-alerts에 영원히 안 뜬다. STAFF_REQUIRED와 동일한 패턴으로 서버에서 필수화한다.
    if (input.category === 'CONTRACT' && !input.retentionUntil) {
      throw new AppException(
        'RETENTION_UNTIL_REQUIRED',
        '계약서 문서는 보존기한을 직접 입력해야 합니다.',
        400,
      );
    }
    const document: MockDocument = {
      id: `doc-${randomUUID()}`,
      category: input.category,
      branchId: input.branchId,
      relatedStaffId: input.category === 'HR_RECORD' ? input.relatedStaffId : undefined,
      title: input.title,
      fileUrl: input.fileUrl,
      fileType: input.fileType,
      fileSize: input.fileSize,
      uploadedBy,
      retentionUntil: this.computeRetentionUntil(input.category, input.relatedStaffId, input.retentionUntil),
      createdAt: new Date().toISOString(),
    };
    this.documents.push(document);
    return document;
  }

  // D9 소프트 삭제 — 계약·인사 분쟁 시 감사 목적으로 복구 가능해야 한다.
  deleteDocument(id: string): void {
    const document = this.findDocumentById(id);
    if (!document) {
      throw new AppException('DOCUMENT_NOT_FOUND', '문서를 찾을 수 없습니다.', 404);
    }
    document.deletedAt = new Date().toISOString();
  }

  // §5-6 — 보존기한이 지난 문서도 자동 삭제하지 않고 경고 대상으로 남긴다(법정 의무는 "최소" 보존기간).
  listRetentionAlerts(withinDays = 30): MockDocument[] {
    const limitStr = toKstDateString(new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000));
    return this.documents
      .filter((d) => !d.deletedAt && d.retentionUntil !== undefined && d.retentionUntil <= limitStr)
      .sort((a, b) => a.retentionUntil!.localeCompare(b.retentionUntil!));
  }
}
