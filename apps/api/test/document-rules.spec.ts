import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { addYearsToDateString, todayKst } from '../src/common/date/kst-date';
import { ACCOUNTS, BRANCH, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * D34 — 문서를 DB로 옮기며 규칙이 그대로인지, 그리고 도메인 문서(자원문서관리 §11)에 "검증되지 않음"으로
 * 남아 있던 규칙들을 확인한다.
 * - 불변규칙 2(RES-T05): HR_RECORD는 대상 직원 필수, 지점 관리자는 타 지점 직원 서류를 못 올린다
 * - 불변규칙 3: 문서 삭제는 본사만, 소프트 삭제(D9) — 행은 남고 조회에서만 빠진다
 * - 자원문서관리 A-6(문서) 보존기한: HR_RECORD는 퇴사일(없으면 오늘 KST)+3년, 임박 목록은 기준일 이하만 보존기한 순
 * - 응답의 이름 필드(지점·업로더·관련 직원)가 DB 조인·묶음 조회로 채워진다
 */
describe('문서 규칙 (D34)', () => {
  let app: INestApplication;
  const call = (token: string, method: 'get' | 'post' | 'delete', path: string, body?: object) =>
    request(app.getHttpServer())[method](`/api/v1${path}`).set('Authorization', token).send(body);
  const hr = (relatedStaffId?: string) => ({
    category: 'HR_RECORD',
    relatedStaffId,
    title: '근로계약서',
    fileUrl: 'https://files.example/hr.pdf',
  });

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('HR_RECORD: 대상 직원 없으면 400 STAFF_REQUIRED, 없는 직원이면 404, 재직자는 오늘(KST)+3년', async () => {
    const admin = await login(app, ACCOUNTS.seochoAdmin);
    expect((await call(admin, 'post', '/documents', hr())).body.error.code).toBe('STAFF_REQUIRED');
    expect((await call(admin, 'post', '/documents', hr('staff-nobody'))).status).toBe(404);

    const ok = await call(admin, 'post', '/documents', hr('staff-seoyeon'));
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({
      branchId: BRANCH.seocho,
      relatedStaffId: 'staff-seoyeon',
      relatedStaffName: '박서연',
      uploadedByName: '김민수',
      branchName: '서초점',
      retentionUntil: addYearsToDateString(todayKst(), 3),
    });
  });

  it('HR_RECORD: 이미 퇴사한 직원의 서류는 퇴사일+3년', async () => {
    await db(app).staff.update({
      where: { id: 'staff-seoyeon' },
      data: { status: 'RESIGNED', resignDate: new Date('2025-03-31T00:00:00Z') },
    });
    const res = await call(await login(app, ACCOUNTS.superAdmin), 'post', '/documents', hr('staff-seoyeon'));
    expect(res.status).toBe(201);
    expect(res.body.data.retentionUntil).toBe('2028-03-31');
  });

  it('지점 관리자는 타 지점 직원의 인사서류를 올릴 수 없다(403) — 자기 지점 직원은 성공(대조군)', async () => {
    const gangnamStaff = await db(app).staff.findFirstOrThrow({ where: { branchId: BRANCH.gangnam } });
    const admin = await login(app, ACCOUNTS.seochoAdmin);
    const before = await db(app).document.count();
    const denied = await call(admin, 'post', '/documents', hr(gangnamStaff.id));
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('DOCUMENT_SCOPE_VIOLATION');
    expect(await db(app).document.count()).toBe(before);
    expect((await call(admin, 'post', '/documents', hr('staff-seoyeon'))).status).toBe(201);
  });

  it('삭제는 본사만 — 지점 관리자는 403, 본사는 소프트 삭제(행은 남고 조회·목록에서 빠짐), 두 번째 삭제는 404', async () => {
    const branchAdmin = await login(app, ACCOUNTS.seochoAdmin);
    const hq = await login(app, ACCOUNTS.superAdmin);
    expect((await call(branchAdmin, 'delete', '/documents/doc-seocho-contract')).status).toBe(403);

    expect((await call(hq, 'delete', '/documents/doc-seocho-contract')).status).toBe(200);
    const row = await db(app).document.findUniqueOrThrow({ where: { id: 'doc-seocho-contract' } });
    expect(row.deletedAt).not.toBeNull(); // D9 — 감사 목적으로 행은 남는다
    expect((await call(hq, 'get', '/documents/doc-seocho-contract')).status).toBe(404);
    const list = await call(hq, 'get', '/documents');
    expect(list.body.data.map((d: { id: string }) => d.id)).not.toContain('doc-seocho-contract');
    expect((await call(hq, 'delete', '/documents/doc-seocho-contract')).status).toBe(404);
  });

  it('보존기한 임박 목록: 기준일(오늘+30일) 이하만, 보존기한 순, 영구 보관·삭제 문서는 제외', async () => {
    const prisma = db(app);
    const day = (d: string) => new Date(`${d}T00:00:00Z`);
    const base = { category: 'CONTRACT' as const, uploadedBy: 'account-haneul', fileUrl: 'https://files.example/c.pdf' };
    const far = addYearsToDateString(todayKst(), 1);
    await prisma.document.createMany({
      data: [
        { ...base, id: 'doc-t-overdue', title: '기한 지남', retentionUntil: day('2020-01-01') },
        { ...base, id: 'doc-t-far', title: '먼 기한', retentionUntil: day(far) },
        { ...base, id: 'doc-t-deleted', title: '삭제됨', retentionUntil: day('2020-01-02'), deletedAt: new Date() },
      ],
    });
    const res = await call(await login(app, ACCOUNTS.superAdmin), 'get', '/documents/retention-alerts');
    const ids = res.body.data.map((d: { id: string }) => d.id);
    // 시드 서초 계약서(보존기한 2026-10-05)는 실행일에 따라 30일 안팎이 달라지므로 순서만 본다
    expect(ids[0]).toBe('doc-t-overdue');
    expect(ids).not.toContain('doc-t-far');
    expect(ids).not.toContain('doc-t-deleted');
    expect(ids).not.toContain('doc-hq-manual'); // 영구 보관(보존기한 없음)
  });

  it('목록 범위: 지점 관리자는 본인 지점 + 전사 문서만, 타 지점 관리자에게 서초 문서는 안 보인다', async () => {
    const seocho = await call(await login(app, ACCOUNTS.seochoAdmin), 'get', '/documents');
    const gangnam = await call(await login(app, ACCOUNTS.gangnamAdmin), 'get', '/documents');
    const idsOf = (res: request.Response) => res.body.data.map((d: { id: string }) => d.id);
    expect(idsOf(seocho)).toEqual(expect.arrayContaining(['doc-hq-manual', 'doc-seocho-contract']));
    expect(idsOf(gangnam)).toContain('doc-hq-manual');
    expect(idsOf(gangnam)).not.toContain('doc-seocho-contract');
    const manual = seocho.body.data.find((d: { id: string }) => d.id === 'doc-hq-manual');
    expect(manual.uploadedByName).toBe('정하늘');
    expect(manual.branchName).toBeUndefined(); // 전사 문서는 지점 이름이 없다
  });
});
