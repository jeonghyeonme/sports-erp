import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, db } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * 회원관리 도메인 — ADR-MEM-01(오프라인↔앱 연동, 회원번호+전화번호 동시 일치 + 시간당 5회 제한).
 * D32 — 회원·계정·연동 실패 기록(MemberLinkAttempt)이 DB라 테스트마다 워커 DB를 새로 만든다.
 */
describe('POST /members/link (오프라인↔앱 연동)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
  });
  afterEach(async () => {
    await app.close();
  });

  const link = (body: Partial<Record<'memberNo' | 'phone' | 'email' | 'password', string>>) =>
    request(app.getHttpServer())
      .post('/api/v1/members/link')
      .send({
        memberNo: 'GANGNAM2026-001',
        phone: '010-2345-6789',
        email: 'younghee@example.com',
        password: 'link-pass-1234',
        ...body,
      });

  it('회원번호+전화번호가 일치하면 새 앱 계정을 만들고 즉시 로그인 토큰을 돌려준다', async () => {
    const res = await link({});
    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user).toMatchObject({ role: 'MEMBER', branchId: 'branch-gangnam' });

    const member = await db(app).member.findUnique({ where: { id: 'member-younghee' } });
    expect(member?.accountId).toBeTruthy();
  });

  it('연동 후에는 그 계정으로 실제 로그인이 된다', async () => {
    await link({});
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'younghee@example.com', password: 'link-pass-1234' });
    expect(res.status).toBe(200);
  });

  it('전화번호가 틀리면 400 MEMBER_LINK_MISMATCH(회원번호가 맞았다는 사실은 노출하지 않는다)', async () => {
    const res = await link({ phone: '010-0000-0000' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MEMBER_LINK_MISMATCH');
  });

  it('존재하지 않는 회원번호도 동일하게 400 MEMBER_LINK_MISMATCH', async () => {
    const res = await link({ memberNo: 'NO-SUCH-001' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MEMBER_LINK_MISMATCH');
  });

  it('이미 앱 계정과 연동된 회원이면 409 MEMBER_ALREADY_LINKED', async () => {
    const res = await link({
      memberNo: 'SEOCHO2026-001',
      phone: '010-1234-5678',
      email: 'another@example.com',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MEMBER_ALREADY_LINKED');
  });

  it('이미 쓰이는 이메일이면 409 EMAIL_ALREADY_EXISTS', async () => {
    const res = await link({ email: 'kim.minsu@spoism.example' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('탈퇴(WITHDRAWN) 회원은 연동 대상이 아니다(일반 불일치와 동일하게 처리)', async () => {
    await db(app).member.update({ where: { id: 'member-younghee' }, data: { status: 'WITHDRAWN' } });
    const res = await link({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MEMBER_LINK_MISMATCH');
  });

  it('휴면(DORMANT) 회원은 정상적으로 연동할 수 있다(대조군)', async () => {
    const res = await link({ memberNo: 'SEOCHO2025-014', phone: '010-9999-0000', email: 'jimin@example.com' });
    expect(res.status).toBe(201);
  });

  it('같은 회원번호로 5회 실패하면 6번째 시도는 429 LINK_ATTEMPTS_EXCEEDED(전화번호가 맞아도 막힌다)', async () => {
    for (let i = 0; i < 5; i++) {
      const failed = await link({ phone: '010-0000-0000' });
      expect(failed.status).toBe(400);
    }
    const res = await link({}); // 이번엔 정확한 전화번호
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('LINK_ATTEMPTS_EXCEEDED');
  });

  it('D32 결정 4 — 실패 기록은 DB에 남아 앱을 다시 띄워도(=다른 인스턴스여도) 제한이 유지된다', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await link({ phone: '010-0000-0000' })).status).toBe(400);
    }
    await app.close();
    app = await createApp(); // 새 프로세스 메모리 — 예전 mock의 Map 기반 제한은 여기서 초기화됐다
    const res = await link({});
    expect(res.status).toBe(429);
  });

  it('동시에 두 번 연동해도 한 계정만 연결된다', async () => {
    const [a, b] = await Promise.all([link({ email: 'first@example.com' }), link({ email: 'second@example.com' })]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const accounts = await db(app).account.count({ where: { email: { in: ['first@example.com', 'second@example.com'] } } });
    expect(accounts).toBe(1);
  });

  it('다른 회원번호에 대한 시도는 서로의 실패 횟수에 영향을 주지 않는다(대조군)', async () => {
    for (let i = 0; i < 5; i++) {
      await link({ phone: '010-0000-0000' }); // GANGNAM2026-001에 4회 이상 실패 축적
    }
    const res = await link({
      memberNo: 'SEOCHO2025-014',
      phone: '010-9999-0000',
      email: 'jimin2@example.com',
    });
    expect(res.status).toBe(201);
  });
});
