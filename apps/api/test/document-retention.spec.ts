import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ACCOUNTS, createApp, login, mockData } from './helpers/app';

/**
 * 자원문서관리 도메인 — ADR-RES-03(CONTRACT 문서 보존기한 서버 필수화).
 * MockDataService가 인메모리 상태를 가지므로 테스트마다 새 앱을 띄운다.
 */
describe('문서 보존기한 — CONTRACT 필수화', () => {
  let app: INestApplication;
  let admin: string; // 서초점 관리자

  const api = (auth: string) => ({
    post: (p: string, b?: object) => request(app.getHttpServer()).post(`/api/v1${p}`).set('Authorization', auth).send(b),
  });

  beforeEach(async () => {
    app = await createApp();
    admin = await login(app, ACCOUNTS.seochoAdmin);
  });
  afterEach(async () => {
    await app.close();
  });

  it('CONTRACT 문서를 retentionUntil 없이 업로드하면 400 RETENTION_UNTIL_REQUIRED', async () => {
    const res = await api(admin).post('/documents', {
      category: 'CONTRACT',
      title: '위탁계약서',
      fileUrl: 'https://files.example/contract.pdf',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('RETENTION_UNTIL_REQUIRED');
  });

  it('CONTRACT 문서에 retentionUntil을 지정하면 그대로 저장된다', async () => {
    const res = await api(admin).post('/documents', {
      category: 'CONTRACT',
      title: '위탁계약서',
      fileUrl: 'https://files.example/contract.pdf',
      retentionUntil: '2036-01-01',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.retentionUntil).toBe('2036-01-01');
  });

  it('대조군: HR_RECORD·MANUAL·OTHER는 retentionUntil 없이도 업로드된다', async () => {
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

  it('차단된 요청은 데이터를 남기지 않는다', async () => {
    const before = mockData(app).documents.length;
    const rejected = await api(admin).post('/documents', {
      category: 'CONTRACT',
      title: '보존기한 없는 계약서',
      fileUrl: 'https://files.example/no-retention.pdf',
    });
    expect(rejected.status).toBe(400);
    expect(mockData(app).documents.length).toBe(before);
  });
});
