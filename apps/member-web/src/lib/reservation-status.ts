import { Reservation } from './types';

// 회원에게 보이는 예약 상태 — 예약 상태와 결제 상태를 합쳐 한 단어로 보여 준다(유료 회차는 결제해야 확정, 예약및결제 A-6).
export function reservationLabel(r: Reservation): { text: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (r.status === 'CANCELLED') {
    if (r.payment?.status === 'REFUNDED') return { text: '취소·환불', tone: 'neutral' };
    if (r.payment?.status === 'APPROVED') return { text: '취소·환불 불가', tone: 'neutral' };
    return { text: '취소', tone: 'neutral' };
  }
  if (r.status === 'REQUESTED') return { text: '결제 대기', tone: 'warning' };
  if (r.status === 'CONFIRMED') return { text: '예약 확정', tone: 'success' };
  if (r.status === 'COMPLETED') return { text: '이용 완료', tone: 'neutral' };
  return { text: '불참', tone: 'danger' };
}

// 예약·결제가 아직 살아 있는(취소할 수 있는) 상태 — api ACTIVE_RESERVATION_STATUSES와 같다.
export function isActive(r: Reservation): boolean {
  return r.status === 'REQUESTED' || r.status === 'CONFIRMED';
}
