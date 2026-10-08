import { Reservation } from '../lib/types';
import { reservationLabel } from '../lib/reservation-status';

export function StatusBadge({ reservation }: { reservation: Reservation }) {
  const { text, tone } = reservationLabel(reservation);
  return <span className={`badge badge-${tone}`}>{text}</span>;
}
