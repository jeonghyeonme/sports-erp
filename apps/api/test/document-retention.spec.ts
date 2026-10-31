import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * 자원문서관리 도메인 — 문서 분류와 보존기한.
 * D69 — 계약서(CONTRACT) 분류를 없앴다(ADR-RES-03의 "계약서 보존기한 직접 입력"도 함께 폐지). 계약서는 계약 회차에서만
 * 다루므로(contract-renewal.spec) 문서로는 받지 않는다. 다른 분류는 예전처럼 보존기한 입력 없이 올라간다.
 * D34 — 문서 원천은 DB라 테스트마다 워커 DB를 되돌리고 새 앱을 띄운다.
 */
describe('문서 분류 — 계약서는 문서로 받지 않는다(D69)', () => {
  let app: INestApplication;
  let admin: string; // 서초점 관리자
  let hq: string;

  const api = (auth: string) => ({
    get: (p: string) => request(app.getHttpServer()).get(`/api/v1${p}`).set('Authorization', auth),
    post: (p: string, b?: object) => request(app.getHttpServer()).post(`/api/v1${p}`).set('Authorization', auth).send(b),
  });

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    admin = await login(app, ACCOUNTS.seochoAdmin);
    hq = await login(app, ACCOUNTS.superAdmin);
  });
  afterEach(async () => {
    await app.close();
  });

  it('CONTRACT 분류로 올리면 본사·지점 모두 400, 문서가 생기지 않는다', async () => {
    const before = await db(app).document.count();
    for (const auth of [admin, hq]) {
      const res = await api(auth).post('/documents', {
        category: 'CONTRACT',
        title: '위탁계약서',
        fileUrl: 'https://files.example/contract.pdf',
      });
      expect(res.status).toBe(400);
    }
    expect(await db(app).document.count()).toBe(before);
  });

  it('CONTRACT 분류로 거르면 빈 목록이다(문서 관리 목록에 계약서가 없다)', async () => {
    const res = await api(hq).get('/documents?category=CONTRACT');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('대조군: MANUAL·OTHER는 보존기한 없이 올라간다(영구 보관)', async () => {
    const manual = await api(admin).post('/documents', {
      category: 'MANUAL',
      title: '사용 매뉴얼',
      fileUrl: 'https://files.example/manual.pdf',
    });
    expect(manual.status).toBe(201);
    expect(manual.body.data.retentionUntil).toBeUndefined();

    const other = await api(admin).post('/documents', {
      category: 'OTHER',
      title: '기타 문서',
      fileUrl: 'https://files.example/other.pdf',
    });
    expect(other.status).toBe(201);
  });
});
