import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, login, mockData } from './helpers/app';

/**
 * 회원 등록의 비즈니스 규칙 — domains/회원관리.md §11 "검증되지 않음" 항목 해소.
 * 미성년 동의(불변규칙 3)와 담당 직원 지점 일치(MEM-T02)는 이미 구현돼 있었지만
 * (옛 1-6문서는 후자를 "미구현"으로 잘못 기재하고 있었다) 전용 테스트가 없었다.
 */
describe('회원 등록 검증 (미성년 동의 / 담당 직원 지점 일치 / 전화번호 중복 경고)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeEach(async () => {
    app = await createApp();
    adminToken = await login(app, ACCOUNTS.seochoAdmin);
  });
  afterEach(async () => {
    await app.close();
  });

  const create = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/api/v1/members').set('Authorization', adminToken).send(body);

  describe('미성년 회원 등록 — 불변규칙 3', () => {
    it('만 19세 미만은 guardianConsent 없이 등록 시도 시 400(GUARDIAN_CONSENT_REQUIRED)', async () => {
      const res = await create({ name: '미성년회원', birthDate: '2015-05-01' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('GUARDIAN_CONSENT_REQUIRED');
    });

    it('만 19세 미만이라도 guardianConsent=true면 등록된다(대조군)', async () => {
      const res = await create({ name: '미성년회원', birthDate: '2015-05-01', guardianConsent: true });
      expect(res.status).toBe(201);
    });

    it('성인은 birthDate가 있어도 guardianConsent 없이 등록된다(대조군)', async () => {
      const res = await create({ name: '성인회원', birthDate: '1990-01-01' });
      expect(res.status).toBe(201);
    });

    it('birthDate를 안 넘기면 나이 판정 대상이 아니라 guardianConsent 없이도 등록된다(대조군)', async () => {
      const res = await create({ name: '생년월일미상' });
      expect(res.status).toBe(201);
    });
  });

  describe('담당 직원(assignedStaffId) 지점 일치 — MEM-T02', () => {
    it('타 지점 소속 직원을 담당으로 배정 시도 시 400(STAFF_BRANCH_MISMATCH)', async () => {
      const res = await create({ name: '신규회원', assignedStaffId: 'staff-choi' }); // 강남점 소속
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('STAFF_BRANCH_MISMATCH');
    });

    it('같은 지점 소속 직원을 담당으로 배정하면 성공한다(대조군)', async () => {
      const res = await create({ name: '신규회원', assignedStaffId: 'staff-seoyeon' }); // 서초점 소속
      expect(res.status).toBe(201);
      expect(res.body.data.assignedStaffId).toBe('staff-seoyeon');
    });

    it('담당 직원을 지정하지 않으면 미배정 상태로 등록된다(대조군)', async () => {
      const res = await create({ name: '신규회원' });
      expect(res.status).toBe(201);
      expect(res.body.data.assignedStaffId).toBeUndefined();
    });
  });

  describe('전화번호 중복 — 차단 아님, 경고만(MEM-T01)', () => {
    it('같은 지점에 동일 전화번호의 활성 회원이 있으면 경고와 함께 생성은 성공한다', async () => {
      const phone = '010-9999-0000';
      const first = await create({ name: '첫번째', phone });
      expect(first.status).toBe(201);

      const second = await create({ name: '두번째', phone });
      expect(second.status).toBe(201); // 차단 아님
      expect(second.body.meta?.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('동일한 전화번호')]),
      );
    });
  });

  it('위탁계약이 TERMINATED인 지점 소속 관리자는 애초에 회원을 등록할 수 없다(참고 — contract-termination.spec.ts가 더 상세히 다룸)', async () => {
    const seocho = mockData(app).branches.find((b) => b.id === BRANCH.seocho)!;
    seocho.contractStatus = 'TERMINATED';
    const res = await create({ name: '차단대상' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BRANCH_TERMINATED');
  });
});
