import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, login, mockData } from './helpers/app';

/**
 * 인사 권한 분리 — 직원은 본사가 채용해서 각 현장에 파견한다(CLAUDE.md "사업 구조", 설계 1-1 §2-2).
 * 채용·재배치·권한(Role) 변경은 본사(SUPER_ADMIN)만 하고, 지점 관리자(BRANCH_ADMIN)는 파견된 인력의 일상 관리만 한다.
 * 역할 검사(@Roles)는 요청 본문 검증(ValidationPipe)보다 먼저 실행되므로, 거부 케이스도 유효한 본문을 보낸다
 * (본문이 유효해야 "권한 때문에 403"임이 분명해진다).
 */
describe('인사 권한 분리', () => {
  let app: INestApplication;
  let staffId: string; // 서초점 소속 직원(서연)
  const tok: Record<string, string> = {};

  const call = (auth: string, method: 'get' | 'post' | 'patch', path: string, body?: object) => {
    const r = request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', auth);
    return body ? r.send(body) : r;
  };

  beforeAll(async () => {
    app = await createApp();
    for (const [k, email] of Object.entries(ACCOUNTS)) tok[k] = await login(app, email);
    staffId = mockData(app).staff.find((s) => s.branchId === BRANCH.seocho && s.name === '박서연')!.id;
  });
  afterAll(async () => {
    await app.close();
  });

  const hireBody = (n: number) => ({ branchId: BRANCH.seocho, name: `신입${n}`, email: `new${n}@spoism.example` });

  describe('채용 POST /staff — 본사만', () => {
    it.each([
      ['지점 관리자', 'seochoAdmin'],
      ['직원', 'seochoStaff'],
      ['회원', 'seochoMember'],
    ])('%s는 채용할 수 없다(403)', async (_label, who) => {
      const res = await call(tok[who], 'post', '/staff', hireBody(1));
      expect(res.status).toBe(403);
    });

    it('거부된 요청은 직원을 만들지 않는다', async () => {
      const before = mockData(app).staff.length;
      await call(tok.seochoAdmin, 'post', '/staff', hireBody(2));
      expect(mockData(app).staff.length).toBe(before);
    });

    it('본사 관리자는 채용할 수 있다(대조군)', async () => {
      const res = await call(tok.superAdmin, 'post', '/staff', hireBody(3));
      expect(res.status).toBe(201);
    });
  });

  describe('재배치 POST /staff/:id/assignments — 본사만', () => {
    it.each([
      ['지점 관리자(소속 지점)', 'seochoAdmin'],
      ['지점 관리자(재배치 대상 지점)', 'gangnamAdmin'],
      ['직원', 'seochoStaff'],
    ])('%s는 재배치할 수 없다(403)', async (_label, who) => {
      const res = await call(tok[who], 'post', `/staff/${staffId}/assignments`, { branchId: BRANCH.gangnam });
      expect(res.status).toBe(403);
    });

    it('거부된 요청은 파견 지점을 바꾸지 않는다', async () => {
      await call(tok.gangnamAdmin, 'post', `/staff/${staffId}/assignments`, { branchId: BRANCH.gangnam });
      expect(mockData(app).staff.find((s) => s.id === staffId)!.branchId).toBe(BRANCH.seocho);
    });

    it('본사 관리자는 재배치할 수 있다(대조군)', async () => {
      const res = await call(tok.superAdmin, 'post', `/staff/${staffId}/assignments`, { branchId: BRANCH.gangnam });
      expect(res.status).toBeLessThan(300);
      expect(mockData(app).staff.find((s) => s.id === staffId)!.branchId).toBe(BRANCH.gangnam);
    });
  });

  describe('권한(Role) 관리 /permissions — 본사만', () => {
    it.each([
      ['지점 관리자', 'seochoAdmin'],
      ['직원', 'seochoStaff'],
    ])('%s는 직원 Role을 변경할 수 없다(403)', async (_label, who) => {
      const res = await call(tok[who], 'patch', `/permissions/staff/${staffId}/role`, { role: 'BRANCH_ADMIN' });
      expect(res.status).toBe(403);
    });

    it.each([
      ['지점 관리자', 'seochoAdmin'],
      ['직원', 'seochoStaff'],
    ])('%s는 권한 목록을 조회할 수 없다(403)', async (_label, who) => {
      expect((await call(tok[who], 'get', '/permissions/staff')).status).toBe(403);
    });
  });

  describe('지점 관리자는 소속 지점 직원의 일상 관리만 한다', () => {
    it('자기 지점 직원 정보를 수정할 수 있다(대조군)', async () => {
      const own = mockData(app).staff.find((s) => s.branchId === BRANCH.seocho && s.id !== staffId)!;
      const res = await call(tok.seochoAdmin, 'patch', `/staff/${own.id}`, { position: '수석 트레이너' });
      expect(res.status).toBe(200);
    });
  });
});
