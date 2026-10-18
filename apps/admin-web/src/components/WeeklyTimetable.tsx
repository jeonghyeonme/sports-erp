import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ApiEnvelope, ProgramRow, ScheduleSlotRow } from '../lib/types';
import { kstToday } from '../lib/kst-date';

// M5(RFP UI/UX "달력, 스케줄표 형태") — 지점 주간 시간표. 회차 예약형 프로그램마다 기존 회차 API를 한 번씩 부른다
// (지점 단위 회차 API를 새로 만들지 않았다 — 한 지점의 PAID_SESSION 프로그램은 몇 개뿐이고, 회차 관리와 같은 캐시 키를 쓴다).

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 그 주 월요일(날짜 문자열 기준 — 요일은 UTC 자정으로 계산해 시간대 영향이 없다)
function mondayOf(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=일
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

type SlotWithProgram = ScheduleSlotRow & { programName: string };

export function WeeklyTimetable({ programs }: { programs: ProgramRow[] }) {
  const reservable = programs.filter((p) => p.pricingType === 'PAID_SESSION' && p.status !== 'ENDED');
  const [weekStart, setWeekStart] = useState(() => mondayOf(kstToday()));
  const days = WEEKDAYS.map((_, i) => addDays(weekStart, i));
  const today = kstToday();

  const results = useQueries({
    queries: reservable.map((p) => ({
      queryKey: ['slots', p.id],
      queryFn: async () => (await api.get<ApiEnvelope<ScheduleSlotRow[]>>(`/programs/${p.id}/slots`)).data.data ?? [],
    })),
  });
  const loading = results.some((r) => r.isLoading);
  const failed = results.some((r) => r.isError);
  const slots: SlotWithProgram[] = results.flatMap((r, i) =>
    (r.data ?? [])
      .filter((s) => s.date >= days[0] && s.date <= days[6])
      .map((s) => ({ ...s, programName: reservable[i].name })),
  );
  const byDay = new Map(days.map((d) => [d, slots.filter((s) => s.date === d).sort((a, b) => a.startTime.localeCompare(b.startTime))]));

  if (reservable.length === 0) return <div className="empty-state">회차 예약형 프로그램이 없습니다.</div>;

  return (
    <div>
      <div className="action-row" style={{ alignItems: 'center', marginBottom: 10 }}>
        <button type="button" className="btn-secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          ← 이전 주
        </button>
        <strong>
          {days[0]} ~ {days[6]}
        </strong>
        <button type="button" className="btn-secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          다음 주 →
        </button>
        <button type="button" className="btn-secondary" onClick={() => setWeekStart(mondayOf(today))}>
          이번 주
        </button>
        {loading && <span className="page-desc">불러오는 중...</span>}
      </div>
      {failed && <div className="forbidden-note">일부 프로그램의 회차를 불러오지 못했습니다. 새로고침하세요.</div>}
      <div className="week-grid">
        {days.map((d, i) => (
          <div key={d} className={d === today ? 'week-col is-today' : 'week-col'}>
            <div className="week-col-head">
              {WEEKDAYS[i]} <span>{d.slice(5).replace('-', '/')}</span>
            </div>
            {(byDay.get(d) ?? []).length === 0 ? (
              <div className="week-empty">-</div>
            ) : (
              byDay.get(d)!.map((s) => (
                <div
                  key={s.id}
                  className={s.bookedCount >= s.capacity ? 'week-slot is-full' : 'week-slot'}
                  title={`${s.programName} ${s.startTime}~${s.endTime} · 예약 ${s.bookedCount}/${s.capacity}`}
                >
                  <div className="week-slot-time">
                    {s.startTime}~{s.endTime}
                  </div>
                  <div className="week-slot-name">{s.programName}</div>
                  <div className="week-slot-count">
                    {s.bookedCount}/{s.capacity}
                    {s.bookedCount >= s.capacity ? ' 마감' : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
