import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { todayKst } from '../src/common/date/kst-date';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { useDenseTemplate } from './helpers/worker-db';

// D58 — 시연 데이터 층(고밀도 템플릿) 위에서 돈다. 기대값은 시드 개수를 박지 않고 DB에서 센다.
useDenseTemplate();

/**
 * RFP 중간 작업 M1·M3(D51, 작업 브리프 B2).
 * - ADR-PRG-04: 프로그램 목록 종목·연령대·시간대 필터(시간대 = 오늘 KST 이후 회차의 시작 시각).
 * - ADR-RES-04: 문서 목록 relatedStaffId 필터(직원 상세 "인사서류" 섹션). 타 지점 직원은 branch-isolation 표가 본다.
 * 이 파일의 쓰기는 이 파일 안에서만 쓰인다(파일마다 워커 DB를 템플릿에서 다시 만든다).
 */
describe('목록 필터 — 프로그램 종목·연령대·시간대(ADR-PRG-04), 직원 인사서류(ADR-RES-04)', () => {
  let app: INestApplication;
  const tok: Record<string, string> = {};

  const get = (auth: string, path: string) => request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', auth);
  const ids = (res: request.Response) => (res.body.data as Array<{ id: string }>).map((r) => r.id).sort();
  // 시드 프로그램의 회차 날짜는 오늘과의 관계가 고정돼 있지 않다 — 이 파일이 만든 프로그램(pf-*)만 비교한다.
  const ownIds = (res: request.Response) => ids(res).filter((id) => id.startsWith('pf-'));

  // 오늘(KST) 기준 n일 뒤 날짜
  const daysFromToday = (n: number) => {
    const d = new Date(`${todayKst()}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d;
  };

  beforeAll(async () => {
    app = await createApp();
    tok.seochoAdmin = await login(app, ACCOUNTS.seochoAdmin);
    tok.seochoMember = await login(app, ACCOUNTS.seochoMember);
    tok.superAdmin = await login(app, ACCOUNTS.superAdmin);

    const prisma = db(app);
    const base = { branchId: BRANCH.seocho, pricingType: 'PAID_SESSION' as const, capacity: 10, status: 'RUNNING' as const, startDate: new Date('2026-09-01T00:00:00Z') };
    await prisma.program.createMany({
      data: [
        { ...base, id: 'pf-morning', name: '아침 수영', category: '수영', ageGroup: 'ADULT' },
        { ...base, id: 'pf-afternoon', name: '오후 수영', category: '수영', ageGroup: 'CHILD' },
        { ...base, id: 'pf-evening', name: '저녁 골프', category: '골프', ageGroup: 'SENIOR' },
        { ...base, id: 'pf-past-only', name: '지난 회차만', category: '골프', ageGroup: 'SENIOR' },
      ],
    });
    const slot = (programId: string, date: Date, startTime: string, endTime: string) => ({ programId, date, startTime, endTime, capacity: 10 });
    await prisma.scheduleSlot.createMany({
      data: [
        slot('pf-morning', daysFromToday(1), '06:30', '07:30'),
        slot('pf-afternoon', daysFromToday(2), '12:00', '13:00'), // 경계: 12:00은 오후
        slot('pf-evening', daysFromToday(0), '18:00', '19:00'), // 경계: 18:00은 저녁, 오늘 회차는 포함
        slot('pf-evening', daysFromToday(3), '11:59', '12:59'), // 같은 프로그램에 오전 회차도 있다
        slot('pf-past-only', daysFromToday(-1), '19:00', '20:00'), // 지난 회차는 시간대 판정에서 빠진다
      ],
    });

    await prisma.document.createMany({
      data: [
        { id: 'doc-hr-seoyeon', category: 'HR_RECORD', branchId: BRANCH.seocho, relatedStaffId: 'staff-seoyeon', title: '근로계약서', fileUrl: 'x', uploadedBy: 'account-haneul' },
        { id: 'doc-hr-minsu', category: 'HR_RECORD', branchId: BRANCH.seocho, relatedStaffId: 'staff-minsu', title: '근로계약서', fileUrl: 'x', uploadedBy: 'account-haneul' },
        { id: 'doc-hr-seoyeon-del', category: 'HR_RECORD', branchId: BRANCH.seocho, relatedStaffId: 'staff-seoyeon', title: '삭제됨', fileUrl: 'x', uploadedBy: 'account-haneul', deletedAt: new Date() },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('프로그램 시간대(ADR-PRG-04)', () => {
    const band = (b: string) => get(tok.seochoMember, `/programs?branchId=${BRANCH.seocho}&timeBand=${b}`);

    it('오전 = 12:00 전에 시작하는 오늘 이후 회차가 있는 프로그램', async () => {
      const res = await band('MORNING');
      expect(res.status).toBe(200);
      expect(ownIds(res)).toEqual(['pf-evening', 'pf-morning']);
    });

    it('오후 = 12:00 이상 18:00 전(12:00 경계 포함)', async () => {
      expect(ownIds(await band('AFTERNOON'))).toEqual(['pf-afternoon']);
    });

    it('저녁 = 18:00 이상(오늘 회차 포함, 지난 회차만 있는 프로그램은 빠진다)', async () => {
      expect(ownIds(await band('EVENING'))).toEqual(['pf-evening']);
    });

    it('모르는 시간대는 빈 목록(500이 아니다)', async () => {
      const res = await band('NIGHT');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('프로그램 종목·연령대(ADR-PRG-04)', () => {
    it('종목으로 거른다', async () => {
      const res = await get(tok.seochoMember, `/programs?branchId=${BRANCH.seocho}&category=${encodeURIComponent('수영')}`);
      expect(ownIds(res)).toEqual(['pf-afternoon', 'pf-morning']);
    });

    it('연령대로 거른다', async () => {
      const res = await get(tok.seochoMember, `/programs?branchId=${BRANCH.seocho}&ageGroup=SENIOR`);
      expect(ownIds(res)).toEqual(['pf-evening', 'pf-past-only']);
    });

    it('종목·연령대·시간대를 함께 걸면 모두 만족하는 것만', async () => {
      const res = await get(tok.seochoMember, `/programs?branchId=${BRANCH.seocho}&category=${encodeURIComponent('골프')}&ageGroup=SENIOR&timeBand=EVENING`);
      expect(ownIds(res)).toEqual(['pf-evening']);
    });

    it('모르는 연령대는 빈 목록', async () => {
      const res = await get(tok.seochoMember, `/programs?branchId=${BRANCH.seocho}&ageGroup=BABY`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('직원 인사서류(ADR-RES-04)', () => {
    it('지점 관리자는 자기 지점 직원의 인사서류만 받는다(삭제 문서 제외)', async () => {
      const res = await get(tok.seochoAdmin, '/documents?relatedStaffId=staff-seoyeon');
      expect(res.status).toBe(200);
      expect(ids(res)).toEqual(['doc-hr-seoyeon']);
    });

    it('본사는 어느 직원이든 본다', async () => {
      const res = await get(tok.superAdmin, '/documents?relatedStaffId=staff-minsu');
      expect(ids(res)).toEqual(['doc-hr-minsu']);
    });

    it('없는 직원은 404', async () => {
      const res = await get(tok.superAdmin, '/documents?relatedStaffId=staff-nobody');
      expect(res.status).toBe(404);
    });
  });
});
