import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, login, mockData } from './helpers/app';

/**
 * 회원관리 도메인 — ADR-MEM-03(회원 상세 요약 + 수강내역/PT잔여세션 탭별 지연 로드).
 * MockDataService가 인메모리 상태를 가지므로 테스트마다 새 앱을 띄운다.
 */
describe('회원 상세 요약 · 수강내역 · PT 잔여세션', () => {
  let app: INestApplication;
  let seochoAdmin: string;
  let gangnamAdmin: string;
  let superAdmin: string;
  const MEMBER_ID = 'member-sujin'; // 서초점 소속, 시드된 수강내역·PT세션 보유

  const api = (auth: string) => ({
    get: (p: string) => request(app.getHttpServer()).get(`/api/v1${p}`).set('Authorization', auth),
    post: (p: string, b?: object) => request(app.getHttpServer()).post(`/api/v1${p}`).set('Authorization', auth).send(b ?? {}),
  });

  beforeEach(async () => {
    app = await createApp();
    seochoAdmin = await login(app, ACCOUNTS.seochoAdmin);
    gangnamAdmin = await login(app, ACCOUNTS.gangnamAdmin);
    superAdmin = await login(app, ACCOUNTS.superAdmin);
  });
  afterEach(async () => {
    await app.close();
  });

  describe('GET /members/:id 요약 필드', () => {
    it('시드된 수강내역·PT세션을 요약해서 돌려준다', async () => {
      const res = await api(seochoAdmin).get(`/members/${MEMBER_ID}`);
      expect(res.status).toBe(200);
      expect(res.body.data.enrollmentCount).toBe(1); // status=ACTIVE 1건
      expect(res.body.data.ptRemainingTotal).toBe(7); // totalSessions10 - usedSessions3
      expect(res.body.data.lastPaymentAt).toBeUndefined(); // 시드된 결제 없음
    });
  });

  describe('수강내역 탭', () => {
    it('GET으로 시드된 수강내역을 programName과 함께 조회한다', async () => {
      const res = await api(seochoAdmin).get(`/members/${MEMBER_ID}/enrollments`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({ programId: 'program-seocho-yoga', programName: '아침 요가' });
    });

    it('POST으로 새 수강을 등록하면 요약 카운트가 늘어난다', async () => {
      const created = await api(seochoAdmin).post(`/members/${MEMBER_ID}/enrollments`, {
        programId: 'program-seocho-pilates',
        enrolledAt: '2026-09-26',
      });
      expect(created.status).toBe(201);
      expect(created.body.data.status).toBe('ACTIVE');

      const summary = await api(seochoAdmin).get(`/members/${MEMBER_ID}`);
      expect(summary.body.data.enrollmentCount).toBe(2);
    });

    it('다른 지점 프로그램으로 등록하면 400 PROGRAM_BRANCH_MISMATCH', async () => {
      const res = await api(seochoAdmin).post(`/members/${MEMBER_ID}/enrollments`, {
        programId: 'program-gangnam-pilates',
        enrolledAt: '2026-09-26',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PROGRAM_BRANCH_MISMATCH');
    });

    it('계약종료 지점 회원에게는 신규 수강 등록이 409 BRANCH_TERMINATED', async () => {
      mockData(app).branches.find((b) => b.id === BRANCH.seocho)!.contractStatus = 'TERMINATED';
      const res = await api(seochoAdmin).post(`/members/${MEMBER_ID}/enrollments`, {
        programId: 'program-seocho-yoga',
        enrolledAt: '2026-09-26',
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BRANCH_TERMINATED');
    });

    it('타 지점 관리자는 조회·등록 둘 다 403', async () => {
      expect((await api(gangnamAdmin).get(`/members/${MEMBER_ID}/enrollments`)).status).toBe(403);
      const res = await api(gangnamAdmin).post(`/members/${MEMBER_ID}/enrollments`, {
        programId: 'program-seocho-yoga',
        enrolledAt: '2026-09-26',
      });
      expect(res.status).toBe(403);
    });
  });

  describe('PT 잔여세션 탭', () => {
    it('GET으로 시드된 세션을 remainingSessions·logs와 함께 조회한다', async () => {
      const res = await api(seochoAdmin).get(`/members/${MEMBER_ID}/pt-sessions`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        totalSessions: 10,
        usedSessions: 3,
        remainingSessions: 7,
        programName: '퍼스널 트레이닝',
      });
      expect(res.body.data[0].logs).toHaveLength(3);
    });

    it('POST으로 새 PT 패키지를 등록하면 remainingSessions가 totalSessions와 같다', async () => {
      const res = await api(seochoAdmin).post(`/members/${MEMBER_ID}/pt-sessions`, {
        programId: 'program-seocho-pt',
        totalSessions: 5,
        purchasedAt: '2026-09-26',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.remainingSessions).toBe(5);
      expect(res.body.data.usedSessions).toBe(0);
    });

    it('세션을 사용(차감)하면 usedSessions가 늘고 로그가 남는다', async () => {
      const before = await api(seochoAdmin).get(`/members/${MEMBER_ID}/pt-sessions`);
      const sessionId = before.body.data[0].id;

      const res = await api(seochoAdmin).post(`/members/${MEMBER_ID}/pt-sessions/${sessionId}/use`, {
        note: '9/26 세션',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.usedSessions).toBe(4);
      expect(res.body.data.remainingSessions).toBe(6);

      const after = await api(seochoAdmin).get(`/members/${MEMBER_ID}/pt-sessions`);
      expect(after.body.data[0].logs).toHaveLength(4);
    });

    it('잔여 세션이 0이면 사용 시도 시 409 PT_SESSION_EXHAUSTED', async () => {
      const before = await api(seochoAdmin).get(`/members/${MEMBER_ID}/pt-sessions`);
      const sessionId = before.body.data[0].id;
      for (let i = 0; i < 7; i++) {
        await api(seochoAdmin).post(`/members/${MEMBER_ID}/pt-sessions/${sessionId}/use`);
      }
      const res = await api(seochoAdmin).post(`/members/${MEMBER_ID}/pt-sessions/${sessionId}/use`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PT_SESSION_EXHAUSTED');
    });

    it('계약종료 지점 회원에게는 신규 PT 패키지 등록이 409 BRANCH_TERMINATED, 기존 세션 사용은 차단되지 않는다', async () => {
      const before = await api(seochoAdmin).get(`/members/${MEMBER_ID}/pt-sessions`);
      const sessionId = before.body.data[0].id;
      mockData(app).branches.find((b) => b.id === BRANCH.seocho)!.contractStatus = 'TERMINATED';

      const created = await api(seochoAdmin).post(`/members/${MEMBER_ID}/pt-sessions`, {
        programId: 'program-seocho-pt',
        totalSessions: 5,
        purchasedAt: '2026-09-26',
      });
      expect(created.status).toBe(409);
      expect(created.body.error.code).toBe('BRANCH_TERMINATED');

      const used = await api(seochoAdmin).post(`/members/${MEMBER_ID}/pt-sessions/${sessionId}/use`);
      expect(used.status).toBe(201);
    });

    it('타 지점 관리자는 조회·등록·사용 전부 거부된다', async () => {
      const before = await api(seochoAdmin).get(`/members/${MEMBER_ID}/pt-sessions`);
      const sessionId = before.body.data[0].id;

      expect((await api(gangnamAdmin).get(`/members/${MEMBER_ID}/pt-sessions`)).status).toBe(403);
      expect(
        (
          await api(gangnamAdmin).post(`/members/${MEMBER_ID}/pt-sessions`, {
            programId: 'program-seocho-pt',
            totalSessions: 5,
            purchasedAt: '2026-09-26',
          })
        ).status,
      ).toBe(403);
      expect((await api(gangnamAdmin).post(`/members/${MEMBER_ID}/pt-sessions/${sessionId}/use`)).status).toBe(403);
    });
  });

  describe('예약·결제 내역 탭(GET /reservations?memberId=)', () => {
    it('SUPER_ADMIN·본인 지점 관리자는 조회 가능, 타 지점 관리자는 403', async () => {
      expect((await api(superAdmin).get(`/reservations?memberId=${MEMBER_ID}`)).status).toBe(200);
      expect((await api(seochoAdmin).get(`/reservations?memberId=${MEMBER_ID}`)).status).toBe(200);
      const res = await api(gangnamAdmin).get(`/reservations?memberId=${MEMBER_ID}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('RESERVATION_SCOPE_VIOLATION');
    });

    it('MEMBER 본인은 memberId 파라미터를 줘도 항상 자기 예약만 본다', async () => {
      const memberToken = await login(app, ACCOUNTS.seochoMember);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/reservations?memberId=member-younghee`)
        .set('Authorization', memberToken);
      expect(res.status).toBe(200);
      expect(res.body.data.every((r: { memberId: string }) => r.memberId === MEMBER_ID)).toBe(true);
    });
  });
});
