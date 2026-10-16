import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useLoad } from '../lib/use-load';
import { describeError, errorCode } from '../lib/errors';
import { CANCEL_DEADLINE_HOURS, dateLabel, slotStartMs, won } from '../lib/format';
import { ApiEnvelope, Program, Reservation, SlotWithCount } from '../lib/types';
import { BottomSheet } from '../components/BottomSheet';
import { SkeletonList } from '../components/Skeleton';

// 예약하기 2단계 — 회차 선택 → 예약 확인 시트 → POST /reservations.
// 호출: 회차 1회(GET /programs/:id/slots) + 예약 1회. 프로그램 정보는 목록 화면이 넘겨 주고,
// 이 주소로 바로 들어온 경우(새로고침)에만 목록을 1회 더 부른다.
export function ProgramSlotsPage() {
  const { programId = '' } = useParams();
  const navigate = useNavigate();
  const passed = (useLocation().state as { program?: Program } | null)?.program;
  const fallback = useLoad<Program[]>(passed ? null : '/programs?status=RUNNING');
  const program = passed ?? fallback.data?.find((p) => p.id === programId);

  const slots = useLoad<SlotWithCount[]>(`/programs/${encodeURIComponent(programId)}/slots`);
  // 렌더 중 Date.now()를 부르지 않도록 화면 진입 시각을 한 번 잡는다(react-hooks purity).
  const [now] = useState(() => Date.now());
  const [selected, setSelected] = useState<SlotWithCount | null>(null);
  // M5(RFP UI/UX "달력, 스케줄표 형태") — 날짜 띠에서 고른 날. null이면 회차가 있는 첫날.
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const closeSheet = () => {
    setSelected(null);
    setSheetError(null);
  };

  const reserve = async () => {
    if (!selected) return;
    setSubmitting(true);
    setSheetError(null);
    try {
      const res = await api.post<ApiEnvelope<Reservation>>('/reservations', { scheduleSlotId: selected.id });
      const reservation = res.data.data!;
      // 결제는 예약 직후에만 한다(B1-2 사용자 결정, log/083). 무료 회차는 결제 없이 바로 확정된다(예약및결제 A-6).
      if (reservation.payment?.status === 'PENDING') {
        navigate(`/pay/${reservation.id}`, { state: { reservation } });
      } else {
        navigate('/reservations', { state: { notice: '예약이 확정됐습니다.' } });
      }
    } catch (err) {
      setSheetError(describeError(err, '예약하지 못했습니다. 잠시 후 다시 시도하세요.'));
      // 정원이 찼거나 회차가 시작됐다면 목록 표시가 낡은 것이다 — 다시 받아 맞춘다.
      if (errorCode(err) === 'SLOT_FULL' || errorCode(err) === 'SLOT_ALREADY_STARTED') slots.reload();
    } finally {
      setSubmitting(false);
    }
  };

  const loadError = slots.error ?? fallback.error;
  if (slots.loading || fallback.loading) return <SkeletonList />;
  if (loadError || !program) {
    return (
      <div className="panel error-panel" role="alert">
        <p>{loadError ? describeError(loadError, '회차를 불러오지 못했습니다.') : '프로그램을 찾을 수 없습니다.'}</p>
        <Link to="/programs" className="secondary-button">
          프로그램 목록으로
        </Link>
      </div>
    );
  }

  // 지난 회차는 보여 주지 않는다. 화면을 열어 둔 사이 시작한 회차는 api가 409 SLOT_ALREADY_STARTED로 막는다(ADR-RSV-05).
  const upcoming = (slots.data ?? []).filter((s) => slotStartMs(s) > now);
  const byDate = new Map<string, SlotWithCount[]>();
  for (const s of upcoming) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  const stripDates = dateStrip(now, [...byDate.keys()]);
  const activeDate = pickedDate && byDate.has(pickedDate) ? pickedDate : (stripDates.find((d) => byDate.has(d)) ?? null);
  const daySlots = activeDate ? (byDate.get(activeDate) ?? []) : [];

  return (
    <div className="stack">
      <div>
        <h1>{program.name}</h1>
        <p className="muted">
          {program.category}
          {program.instructorName && ` · ${program.instructorName}`} · {program.price > 0 ? `회당 ${won(program.price)}` : '무료'}
        </p>
      </div>

      {/* RFP 강사·프로그램 게시 "종목별 강사 정보"(log/114) — 프로그램 응답에 실려 와서 추가 호출이 없다. */}
      {program.instructorName && (program.instructorSpecialty || program.instructorBio) && (
        <section className="panel stack-sm" aria-label="강사 소개">
          <h2 className="card-title">강사 {program.instructorName}</h2>
          {program.instructorSpecialty && <p className="muted">전문 종목: {program.instructorSpecialty}</p>}
          {program.instructorBio && <p className="notice-body">{program.instructorBio}</p>}
        </section>
      )}

      {upcoming.length === 0 && <p className="panel empty-state">예약할 수 있는 회차가 없습니다.</p>}

      {upcoming.length > 0 && (
        <div className="date-strip" role="tablist" aria-label="날짜 선택">
          {stripDates.map((d) => {
            const count = byDate.get(d)?.length ?? 0;
            const [, m, day] = d.split('-').map(Number);
            return (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={d === activeDate}
                aria-label={`${dateLabel(d)} 회차 ${count}개`}
                className={d === activeDate ? 'date-chip is-active' : 'date-chip'}
                disabled={count === 0}
                onClick={() => setPickedDate(d)}
              >
                <span className="date-chip-week">{dateLabel(d).slice(-2, -1)}</span>
                <span className="date-chip-day">{day === 1 ? `${m}/${day}` : day}</span>
                <span className={count > 0 ? 'date-chip-dot' : 'date-chip-dot is-empty'} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}

      {activeDate && (
        <section className="stack-sm">
          <h2 className="section-title">{dateLabel(activeDate)}</h2>
          <ul className="list">
            {daySlots.map((s) => {
              const left = Math.max(s.capacity - s.bookedCount, 0);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className="panel slot-button"
                    disabled={left === 0}
                    onClick={() => setSelected(s)}
                  >
                    <span className="slot-time">
                      {s.startTime}–{s.endTime}
                    </span>
                    <span className={left === 0 ? 'slot-left is-full' : 'slot-left'}>
                      {left === 0 ? '마감' : `${left}자리 남음`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {selected && (
        <BottomSheet title="예약 확인" onClose={closeSheet} busy={submitting}>
          <dl className="summary">
            <dt>프로그램</dt>
            <dd>{program.name}</dd>
            <dt>일시</dt>
            <dd>
              {dateLabel(selected.date)} {selected.startTime}–{selected.endTime}
            </dd>
            <dt>금액</dt>
            <dd>{program.price > 0 ? won(program.price) : '무료'}</dd>
          </dl>
          <p className="muted">
            {program.price > 0 && '예약 후 바로 결제해야 확정됩니다. '}
            회차 시작 {CANCEL_DEADLINE_HOURS}시간 전까지 취소하면 전액 환불됩니다.
          </p>
          {sheetError && (
            <p className="form-error" role="alert">
              {sheetError}
            </p>
          )}
          <div className="sheet-actions">
            <button type="button" className="secondary-button" onClick={closeSheet} disabled={submitting}>
              닫기
            </button>
            <button type="button" className="primary-button" onClick={() => void reserve()} disabled={submitting}>
              {submitting ? '예약 중…' : program.price > 0 ? '예약하고 결제하기' : '예약하기'}
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

// 날짜 띠 — 오늘(KST)부터 2주, 회차가 그 뒤에도 있으면 마지막 회차 날까지(최대 62일).
function dateStrip(now: number, slotDates: string[]): string[] {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(now));
  const last = slotDates.reduce((a, b) => (b > a ? b : a), today);
  const out: string[] = [];
  const d = new Date(`${today}T00:00:00Z`);
  for (let i = 0; i < 62; i++) {
    const s = d.toISOString().slice(0, 10);
    if (i >= 14 && s > last) break;
    out.push(s);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
