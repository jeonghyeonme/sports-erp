import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useLoad } from '../lib/use-load';
import { describeError } from '../lib/errors';
import { CANCEL_DEADLINE_HOURS, dateLabel, isBeforeCancelDeadline, slotStartMs, won } from '../lib/format';
import { isActive } from '../lib/reservation-status';
import { ApiEnvelope, Reservation } from '../lib/types';
import { BottomSheet } from '../components/BottomSheet';
import { StatusBadge } from '../components/StatusBadge';
import { SkeletonList } from '../components/Skeleton';

const MAX_ROWS = 100; // api 목록 상한(D43)

// 내 예약 — 호출: 목록 1회(GET /reservations, MEMBER는 서버가 본인 것만 준다) + 취소 1회(PATCH /reservations/:id/cancel).
// 취소 응답으로 목록 항목을 바꿔 끼우고 다시 조회하지 않는다.
// D43 — 목록은 쪽 단위로 오고 최근 예약부터다. 회원 한 명의 예약은 적어서 상한(100건)만큼 한 번에 받는다.
export function MyReservationsPage() {
  const passedNotice = (useLocation().state as { notice?: string } | null)?.notice;
  const { data, meta, error, loading, reload, mutate } = useLoad<Reservation[]>(`/reservations?limit=${MAX_ROWS}`);
  const total = typeof meta?.total === 'number' ? meta.total : 0;
  const [now] = useState(() => Date.now());
  const [target, setTarget] = useState<Reservation | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(passedNotice ?? null);

  const closeSheet = () => {
    setTarget(null);
    setSheetError(null);
  };

  const cancel = async () => {
    if (!target) return;
    setCancelling(true);
    setSheetError(null);
    try {
      const res = await api.patch<ApiEnvelope<Reservation>>(`/reservations/${encodeURIComponent(target.id)}/cancel`, {});
      const updated = res.data.data!;
      mutate((list) => list.map((r) => (r.id === updated.id ? updated : r)));
      setNotice(cancelNotice(updated));
      closeSheet();
    } catch (err) {
      setSheetError(describeError(err, '취소하지 못했습니다. 잠시 후 다시 시도하세요.'));
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <SkeletonList />;
  if (error) {
    return (
      <div className="panel error-panel" role="alert">
        <p>{describeError(error, '예약을 불러오지 못했습니다.')}</p>
        <button type="button" className="secondary-button" onClick={reload}>
          다시 시도
        </button>
      </div>
    );
  }

  const all = data ?? [];
  const startOf = (r: Reservation) => (r.slot ? slotStartMs(r.slot) : 0);
  const upcoming = all.filter((r) => isActive(r) && startOf(r) > now).sort((a, b) => startOf(a) - startOf(b));
  const past = all.filter((r) => !upcoming.includes(r)).sort((a, b) => startOf(b) - startOf(a));

  return (
    <div className="stack">
      <h1>내 예약</h1>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      <section className="stack-sm">
        <h2 className="section-title">다가오는 예약</h2>
        {upcoming.length === 0 ? (
          <div className="panel empty-state">
            <p>다가오는 예약이 없습니다.</p>
            <Link to="/programs" className="text-link">
              프로그램 예약하기
            </Link>
          </div>
        ) : (
          <ul className="list">
            {upcoming.map((r) => (
              <li key={r.id} className="panel reservation-card">
                <ReservationSummary reservation={r} />
                <button type="button" className="secondary-button" onClick={() => setTarget(r)}>
                  예약 취소
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {total > MAX_ROWS && <p className="muted">최근 예약 {MAX_ROWS}건만 보여 줍니다.</p>}

      {past.length > 0 && (
        <section className="stack-sm">
          <h2 className="section-title">지난·취소한 예약</h2>
          <ul className="list">
            {past.map((r) => (
              <li key={r.id} className="panel reservation-card is-past">
                <ReservationSummary reservation={r} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {target && (
        <BottomSheet title="예약을 취소할까요?" onClose={closeSheet} busy={cancelling}>
          <ReservationSummary reservation={target} />
          <p className={refundTone(target, now)}>{refundGuide(target, now)}</p>
          {sheetError && (
            <p className="form-error" role="alert">
              {sheetError}
            </p>
          )}
          <div className="sheet-actions">
            <button type="button" className="secondary-button" onClick={closeSheet} disabled={cancelling}>
              유지하기
            </button>
            <button type="button" className="danger-button" onClick={() => void cancel()} disabled={cancelling}>
              {cancelling ? '취소 중…' : '예약 취소'}
            </button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

function ReservationSummary({ reservation: r }: { reservation: Reservation }) {
  return (
    <div className="reservation-summary">
      <div className="reservation-head">
        <span className="program-name">{r.programName}</span>
        <StatusBadge reservation={r} />
      </div>
      {r.slot && (
        <span className="muted">
          {dateLabel(r.slot.date)} {r.slot.startTime}–{r.slot.endTime}
        </span>
      )}
      {r.payment && <span className="muted">{won(r.payment.amount)}</span>}
    </div>
  );
}

// 예약및결제 A-6 — 결제 전(PENDING)은 결제 실패 처리만, 승인 건은 마감 전이면 전액 환불·마감 이내면 환불 없음.
// api에는 "취소 마감" 오류가 없다(마감 이내 취소도 성공한다). 그래서 취소 전에 이 문구로 미리 알린다.
function refundGuide(r: Reservation, now: number): string {
  if (r.payment?.status === 'PENDING') return '결제 전이라 청구된 금액이 없습니다.';
  if (r.payment?.status !== 'APPROVED') return '무료 회차라 환불할 금액이 없습니다.';
  if (r.slot && isBeforeCancelDeadline(r.slot, now)) return `지금 취소하면 ${won(r.payment.amount)} 전액 환불됩니다.`;
  return `취소 마감(회차 시작 ${CANCEL_DEADLINE_HOURS}시간 전)이 지나 환불되지 않습니다. 그래도 취소하면 자리는 다른 회원에게 돌아갑니다.`;
}

function refundTone(r: Reservation, now: number): string {
  const noRefund = r.payment?.status === 'APPROVED' && r.slot && !isBeforeCancelDeadline(r.slot, now);
  return noRefund ? 'form-error' : 'muted';
}

// 취소 결과 안내는 서버 응답의 결제 상태로 정한다(화면의 마감 계산과 서버 판정이 어긋나도 서버가 맞다).
function cancelNotice(r: Reservation): string {
  if (r.payment?.status === 'REFUNDED') return `예약을 취소했습니다. ${won(r.payment.amount)}이 환불됩니다.`;
  if (r.payment?.status === 'APPROVED') return '예약을 취소했습니다. 취소 마감이 지나 환불되지 않습니다.';
  return '예약을 취소했습니다.';
}
