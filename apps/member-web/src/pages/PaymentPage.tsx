import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useLoad } from '../lib/use-load';
import { describeError } from '../lib/errors';
import { dateLabel, won } from '../lib/format';
import { ApiEnvelope, Payment, Reservation } from '../lib/types';
import { SkeletonList } from '../components/Skeleton';

// 예약하기 3단계 — 모의 결제(POST /payments/:reservationId/mock-pay, 호출 1회). 결제는 예약 직후 이 화면에서만 한다
// (B1-2 사용자 결정, log/083). 예약 화면이 넘겨 준 예약을 쓰고, 이 주소를 새로고침했을 때만 내 예약을 1회 부른다.
// 금액은 서버가 Program 가격으로 정한 Payment.amount를 보여 줄 뿐이다(예약및결제 불변식 ④ — 클라이언트 금액을 보내지 않는다).
export function PaymentPage() {
  const { reservationId = '' } = useParams();
  const passed = (useLocation().state as { reservation?: Reservation } | null)?.reservation;
  // D43 — 목록은 최근 예약부터 오므로 방금 만든 예약은 첫 쪽에 있다.
  const fallback = useLoad<Reservation[]>(passed ? null : '/reservations?limit=20');
  const reservation = passed ?? fallback.data?.find((r) => r.id === reservationId);

  const [paid, setPaid] = useState<Payment | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setPaying(true);
    setError(null);
    try {
      const res = await api.post<ApiEnvelope<{ payment: Payment }>>(
        `/payments/${encodeURIComponent(reservationId)}/mock-pay`,
      );
      setPaid(res.data.data!.payment);
    } catch (err) {
      setError(describeError(err, '결제하지 못했습니다. 잠시 후 다시 시도하세요.'));
    } finally {
      setPaying(false);
    }
  };

  if (fallback.loading) return <SkeletonList />;
  if (fallback.error || !reservation) {
    return (
      <div className="panel error-panel" role="alert">
        <p>{fallback.error ? describeError(fallback.error, '예약을 불러오지 못했습니다.') : '예약을 찾을 수 없습니다.'}</p>
        <Link to="/reservations" className="secondary-button">
          내 예약으로
        </Link>
      </div>
    );
  }

  const amount = reservation.payment?.amount ?? 0;
  const alreadyDone = !paid && reservation.payment?.status !== 'PENDING';

  return (
    <div className="stack">
      <h1>{paid ? '결제 완료' : '결제'}</h1>
      <div className="panel">
        <dl className="summary">
          <dt>프로그램</dt>
          <dd>{reservation.programName}</dd>
          {reservation.slot && (
            <>
              <dt>일시</dt>
              <dd>
                {dateLabel(reservation.slot.date)} {reservation.slot.startTime}–{reservation.slot.endTime}
              </dd>
            </>
          )}
          <dt>결제 금액</dt>
          <dd className="amount">{won(paid?.amount ?? amount)}</dd>
          <dt>결제 수단</dt>
          <dd>모의 카드 결제(실제 청구 없음)</dd>
          {paid?.mockApprovalNo && (
            <>
              <dt>승인 번호</dt>
              <dd>{paid.mockApprovalNo}</dd>
            </>
          )}
        </dl>
      </div>

      {paid ? (
        <>
          <p className="notice" role="status">
            예약이 확정됐습니다.
          </p>
          <Link to="/reservations" className="primary-button">
            내 예약 보기
          </Link>
        </>
      ) : alreadyDone ? (
        <>
          <p className="notice">이미 결제했거나 결제할 수 없는 예약입니다.</p>
          <Link to="/reservations" className="secondary-button">
            내 예약 보기
          </Link>
        </>
      ) : (
        <>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="primary-button" onClick={() => void pay()} disabled={paying}>
            {paying ? '결제 중…' : `${won(amount)} 결제하기`}
          </button>
          <p className="muted">결제하지 않고 나가면 예약이 확정되지 않습니다. 결제 대기 예약은 내 예약에서 취소할 수 있습니다.</p>
        </>
      )}
    </div>
  );
}
