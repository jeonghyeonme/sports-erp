import { INestApplication } from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import request from 'supertest';
import { ACCOUNTS, createApp, db, login } from './helpers/app';
import { resetWorkerDb } from './helpers/worker-db';

/**
 * 혼잡도관리 ADR-FAC-05 — 혼잡도 = 지금 진행 중인 회차의 예약 인원(확정·체크인) + 예약 외 현장 인원(관리자 입력).
 * 회차는 지금 시각(KST) 앞뒤 30분으로 DB에 직접 만든다 — 자정 근처에도 같은 날 안에 머물도록 00:00·24:00에서 자른다
 * (회차 시각은 'HH:MM' 문자열 비교라 '24:00'도 지금보다 뒤다).
 * 기준 시드: 서초 헬스장 정원 60·현장 18, 서초 수영장 정원 30·현장 26, 강남 헬스장 정원 50·현장 12.
 */
const KST_MS = 9 * 3600_000;
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

function kstNow() {
  const d = new Date(Date.now() + KST_MS);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
const dayOf = (date: string, offset = 0) => new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86_400_000);

describe('혼잡도 — 진행 중 회차의 예약 인원을 더한다 (ADR-FAC-05)', () => {
  let app: INestApplication;

  const get = async (email: string, path: string) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set('Authorization', await login(app, email));
  const facility = (rows: Array<{ id: string }>, id: string) => rows.find((f) => f.id === id);

  async function slot(programId: string, date: Date, startTime: string, endTime: string, statuses: Array<[string, ReservationStatus]>) {
    const s = await db(app).scheduleSlot.create({ data: { programId, date, startTime, endTime, capacity: 20 } });
    for (const [memberId, status] of statuses) {
      await db(app).reservation.create({ data: { memberId, scheduleSlotId: s.id, status } });
    }
  }

  beforeEach(async () => {
    await resetWorkerDb();
    app = await createApp();
    const { date, minutes } = kstNow();
    const start = hhmm(Math.max(0, minutes - 30));
    const end = hhmm(Math.min(24 * 60, minutes + 30));
    // 서초 헬스장(요가) 진행 중 회차 — 확정 1 + 체크인 2 = 3. 결제 대기·취소·노쇼는 세지 않는다.
    // (활성 예약 유일성은 REQUESTED·CONFIRMED에만 걸려 같은 회원의 체크인·취소 행을 함께 둘 수 있다.)
    await slot('program-seocho-yoga', dayOf(date), start, end, [
      ['member-sujin', 'CONFIRMED'],
      ['member-sujin', 'COMPLETED'],
      ['member-dormant', 'COMPLETED'],
      ['member-dormant', 'REQUESTED'],
      ['member-sujin', 'CANCELLED'],
      ['member-dormant', 'NO_SHOW'],
    ]);
    // 같은 시설이라도 진행 중이 아닌 회차(내일·어제 같은 시각)는 세지 않는다.
    await slot('program-seocho-yoga', dayOf(date, 1), start, end, [['member-dormant', 'CONFIRMED']]);
    await slot('program-seocho-yoga', dayOf(date, -1), start, end, [['member-dormant', 'COMPLETED']]);
    // 다른 지점·다른 시설의 진행 중 회차는 그 시설에만 더해진다.
    await slot('program-gangnam-pilates', dayOf(date), start, end, [['member-younghee', 'CONFIRMED']]);
  });
  afterEach(async () => {
    await app.close();
  });

  it('지점 관리자 목록 — 예약 3 + 현장 18 = 21명, 단계는 합계로(21/60 → 2단계). 예약 없는 시설은 현장만', async () => {
    const res = await get(ACCOUNTS.seochoAdmin, '/facilities?branchId=branch-seocho');
    expect(res.status).toBe(200);
    expect(facility(res.body.data, 'facility-seocho-gym')).toMatchObject({
      reservedCount: 3,
      currentCount: 18,
      totalCount: 21,
      level: 2,
    });
    expect(facility(res.body.data, 'facility-seocho-pool')).toMatchObject({
      reservedCount: 0,
      currentCount: 26,
      totalCount: 26,
      level: 5,
    });
  });

  it('회원도 같은 값을 본다(회원 웹 혼잡도 카드)', async () => {
    const res = await get(ACCOUNTS.seochoMember, '/facilities');
    expect(res.status).toBe(200);
    expect(facility(res.body.data, 'facility-seocho-gym')).toMatchObject({ reservedCount: 3, totalCount: 21 });
  });

  it('다른 지점의 진행 중 회차는 그 지점 시설에만 더해진다', async () => {
    const res = await get(ACCOUNTS.gangnamAdmin, '/facilities?branchId=branch-gangnam');
    expect(facility(res.body.data, 'facility-gangnam-gym')).toMatchObject({ reservedCount: 1, currentCount: 12, totalCount: 13 });
  });

  it('현장 인원을 입력하면 응답이 예약 인원을 더한 합계로 단계를 다시 매긴다(3 + 40 = 43/60 → 4단계)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/facilities/facility-seocho-gym/congestion/manual')
      .set('Authorization', await login(app, ACCOUNTS.seochoAdmin))
      .send({ currentCount: 40 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ reservedCount: 3, currentCount: 40, totalCount: 43, level: 4 });
  });

  it('예약이 취소되면 다음 조회에서 바로 빠진다', async () => {
    const { date } = kstNow();
    await db(app).reservation.updateMany({
      where: { memberId: 'member-sujin', status: 'CONFIRMED', scheduleSlot: { date: dayOf(date), programId: 'program-seocho-yoga' } },
      data: { status: 'CANCELLED' },
    });
    const res = await get(ACCOUNTS.seochoAdmin, '/facilities?branchId=branch-seocho');
    expect(facility(res.body.data, 'facility-seocho-gym')).toMatchObject({ reservedCount: 2, totalCount: 20 });
  });
});
