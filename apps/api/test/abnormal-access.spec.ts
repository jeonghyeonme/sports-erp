import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request, { Response } from 'supertest';
import { ACCOUNTS, createApp, db, login } from './helpers/app';

/**
 * 비정상 접근 경로 — 액세스 토큰 만료, 권한 밖 직접 호출, 잘못된 입력(12주차 덱 "다음 할 일", 진행률 D80 검증 묶음).
 * 상태 코드와 오류 코드(error.code)는 정확히 본다. 메시지는 정한 문구가 아니라 프레임워크 기본값이 섞여 있어
 * 문구 자체를 고정하지 않고, 비어 있지 않으며 내부 정보(스택·파일 경로·JSON 파서 상세)가 없는지만 본다(사용자 결정 C).
 *
 * 이미 다른 파일이 보는 것은 여기서 다시 세지 않는다 — 토큰 없이 호출하면 401(상태만)은 smoke,
 * 역할별 채용·재배치 403과 데이터 미변경은 hr-authority, 회원의 처리 대기함 403은 inbox, 세부 권한 상한은 permission-matrix.
 */
const INTERNAL_DETAIL = [/\n\s+at /, /node_modules/, /\.ts:\d+/, /[\\/]src[\\/]/, /SyntaxError/, /Unexpected token/i, /JSON at position/i];

function expectSafeError(res: Response, status: number, code: string) {
  expect([res.status, res.body?.success, res.body?.error?.code]).toEqual([status, false, code]);
  const message: unknown = res.body.error.message;
  expect(typeof message).toBe('string');
  expect((message as string).trim().length).toBeGreaterThan(0);
  for (const pattern of INTERNAL_DETAIL) expect(message).not.toMatch(pattern);
}

describe('비정상 접근 경로', () => {
  let app: INestApplication;
  const get = (path: string, auth?: string) => {
    const r = request(app.getHttpServer()).get(`/api/v1${path}`);
    return auth ? r.set('Authorization', auth) : r;
  };
  const postJson = (path: string, auth: string, raw: string) =>
    request(app.getHttpServer()).post(`/api/v1${path}`).set('Authorization', auth).set('Content-Type', 'application/json').send(raw);

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => {
    await app.close();
  });

  describe('액세스 토큰 만료', () => {
    // 서버와 같은 JwtService(같은 서명 키)로 만료 시각만 과거인 토큰을 만든다 — 키 값은 테스트가 읽지 않는다.
    const tokenFor = async (email: string, expiresIn: string) => {
      const { id } = await db(app).account.findFirstOrThrow({ where: { email, isActive: true } });
      return `Bearer ${app.get(JwtService).sign({ sub: id }, { expiresIn: expiresIn as never })}`;
    };

    it('만료된 토큰은 401 UNAUTHORIZED', async () => {
      expectSafeError(await get('/members', await tokenFor(ACCOUNTS.superAdmin, '-10s')), 401, 'UNAUTHORIZED');
    });

    it('같은 방식으로 만든 유효한 토큰은 200(대조군)', async () => {
      expect((await get('/members', await tokenFor(ACCOUNTS.superAdmin, '5m'))).status).toBe(200);
    });
  });

  describe('권한 밖 직접 호출 — 화면을 거치지 않고 API를 부른다', () => {
    it('토큰 없이 보호된 API는 401 UNAUTHORIZED', async () => {
      expectSafeError(await get('/members'), 401, 'UNAUTHORIZED');
    });

    // GET /members는 본사·지점 관리자만(@Roles). 회원·직원 토큰으로 직접 부르면 막힌다.
    it.each([
      ['회원', ACCOUNTS.seochoMember],
      ['직원', ACCOUNTS.seochoStaff],
    ])('%s 토큰으로 회원 목록을 부르면 403 FORBIDDEN', async (_label, email) => {
      expectSafeError(await get('/members', await login(app, email)), 403, 'FORBIDDEN');
    });

    it('자기 지점 관리자는 같은 요청이 200(대조군)', async () => {
      expect((await get('/members', await login(app, ACCOUNTS.seochoAdmin))).status).toBe(200);
    });
  });

  describe('잘못된 입력 — 회원 등록 POST /members(지점 관리자)', () => {
    let admin: string;
    beforeAll(async () => {
      admin = await login(app, ACCOUNTS.seochoAdmin);
    });

    it('형식이 깨진 JSON 본문은 400 INVALID_JSON — 파서 문구(오류 위치)를 내보내지 않는다', async () => {
      expectSafeError(await postJson('/members', admin, '{"name": "비정상'), 400, 'INVALID_JSON');
    });

    it('정의되지 않은 필드를 끼워 보내면 400 VALIDATION_ERROR', async () => {
      const res = await postJson('/members', admin, JSON.stringify({ name: '비정상 입력', role: 'SUPER_ADMIN' }));
      expectSafeError(res, 400, 'VALIDATION_ERROR');
    });

    it('불리언 자리에 문자열을 보내면 400 VALIDATION_ERROR', async () => {
      const res = await postJson('/members', admin, JSON.stringify({ name: '비정상 입력', guardianConsent: 'yes' }));
      expectSafeError(res, 400, 'VALIDATION_ERROR');
    });
  });
});
