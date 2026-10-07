import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, BRANCH, createApp, login } from './helpers/app';
import { maskPhone, maskPhones } from '../src/common/privacy/mask-phone';

/**
 * ADR-MEM-04 — 목록 응답의 전화번호 마스킹(회원관리 Q10, RFP 사용자인터페이스보안).
 * 목록(회원·직원·강사)은 역할과 무관하게 마스킹하고, 상세·본인 조회는 원문을 준다.
 */
describe('maskPhone — 형식', () => {
  it.each([
    ['010-1234-5678', '010-****-5678'],
    ['01012345678', '010****5678'],
    ['02-123-4567', '**-***-4567'], // 10자리 미만은 끝 4자리만
    ['1234', '****'],
    ['', ''],
  ])('%s → %s', (input, expected) => {
    expect(maskPhone(input)).toBe(expected);
  });

  it('값이 없으면 그대로 두고, 목록 원본 행은 바꾸지 않는다', () => {
    expect(maskPhone(undefined)).toBeUndefined();
    const rows = [{ phone: '010-1234-5678' }, { name: 'x' } as { phone?: string }];
    expect(maskPhones(rows)).toEqual([{ phone: '010-****-5678' }, { name: 'x' }]);
    expect(rows[0].phone).toBe('010-1234-5678');
  });
});

describe('전화번호 마스킹 — 목록은 마스킹, 상세·본인은 원문', () => {
  let app: INestApplication;
  const token: Record<keyof typeof ACCOUNTS, string> = {} as never;
  const RAW_PHONE = /^\d{2,3}-\d{3,4}-\d{4}$/;

  const get = (auth: string, p: string) =>
    request(app.getHttpServer()).get(`/api/v1${p}`).set('Authorization', auth);

  beforeAll(async () => {
    app = await createApp();
    for (const key of Object.keys(ACCOUNTS) as Array<keyof typeof ACCOUNTS>) {
      token[key] = await login(app, ACCOUNTS[key]);
    }
  });
  afterAll(async () => {
    await app.close();
  });

  describe('회원', () => {
    it.each(['superAdmin', 'seochoAdmin'] as const)('%s의 회원 목록에는 원문 전화번호가 하나도 없다', async (who) => {
      const res = await get(token[who], `/members?branchId=${BRANCH.seocho}`);
      expect(res.status).toBe(200);
      const phones = (res.body.data as Array<{ phone?: string }>).map((m) => m.phone).filter(Boolean);
      expect(phones.length).toBeGreaterThan(0);
      for (const phone of phones) expect(phone).not.toMatch(RAW_PHONE);
      const sujin = res.body.data.find((m: { id: string }) => m.id === 'member-sujin');
      expect(sujin.phone).toBe('010-****-5678');
    });

    it('전화번호 원문으로 검색해도 찾되, 결과는 마스킹된다', async () => {
      const res = await get(token.seochoAdmin, `/members?q=010-1234-5678`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((m: { id: string }) => m.id)).toContain('member-sujin');
      expect(res.body.data[0].phone).toBe('010-****-5678');
    });

    it.each(['superAdmin', 'seochoAdmin', 'seochoMember'] as const)('%s의 회원 상세는 원문이다', async (who) => {
      const res = await get(token[who], '/members/member-sujin');
      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBe('010-1234-5678');
    });
  });

  describe('직원', () => {
    it('직원 목록은 마스킹된다', async () => {
      const res = await get(token.seochoAdmin, `/staff?branchId=${BRANCH.seocho}`);
      expect(res.status).toBe(200);
      const seoyeon = res.body.data.find((s: { id: string }) => s.id === 'staff-seoyeon');
      expect(seoyeon.phone).toBe('010-****-3333');
    });

    it('직원 상세와 본인(me)은 원문이다', async () => {
      const detail = await get(token.seochoAdmin, '/staff/staff-seoyeon');
      expect(detail.status).toBe(200);
      expect(detail.body.data.phone).toBe('010-2222-3333');

      const me = await get(token.seochoStaff, '/staff/me');
      expect(me.status).toBe(200);
      expect(me.body.data.phone).toBe('010-2222-3333');
    });
  });

  describe('강사', () => {
    it('등록 응답은 원문, 회원이 보는 강사 목록은 마스킹된다', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/instructors')
        .set('Authorization', token.seochoAdmin)
        .send({ name: '마스킹 확인 강사', phone: '010-5555-6666' });
      expect(created.status).toBe(201);
      expect(created.body.data.phone).toBe('010-5555-6666');

      const res = await get(token.seochoMember, `/instructors?branchId=${BRANCH.seocho}`);
      expect(res.status).toBe(200);
      const row = res.body.data.find((i: { id: string }) => i.id === created.body.data.id);
      expect(row.phone).toBe('010-****-6666');
    });
  });
});
