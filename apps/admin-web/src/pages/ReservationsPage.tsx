import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/use-auth';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { ApiEnvelope, PaymentRow, ProgramRow, ReservationRow, ReservationStatus, ScheduleSlotRow } from '../lib/types';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

const STATUS_LABEL: Record<ReservationStatus, string> = {
  REQUESTED: '결제 대기',
  CONFIRMED: '확정',
  CANCELLED: '취소',
  COMPLETED: '완료',
  NO_SHOW: '노쇼',
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function slotLabel(slot?: ScheduleSlotRow): string {
  if (!slot) return '-';
  return `${slot.date} ${slot.startTime}~${slot.endTime}`;
}

// 06문서 §5 GET /programs/:id/slots — 프로그램 하나의 회차 목록 + 예약하기 버튼(회원 전용).
function ProgramSlotsCard({ program }: { program: ProgramRow }) {
  const queryClient = useQueryClient();
  const slotsQuery = useQuery<ScheduleSlotRow[], AxiosError<ApiErrorBody>>({
    queryKey: ['slots', program.id],
    queryFn: async () => (await api.get<ApiEnvelope<ScheduleSlotRow[]>>(`/programs/${program.id}/slots`)).data.data ?? [],
  });

  const reserveMutation = useMutation<ReservationRow, AxiosError<ApiErrorBody>, string>({
    mutationFn: async (scheduleSlotId) =>
      (await api.post<ApiEnvelope<ReservationRow>>('/reservations', { scheduleSlotId })).data.data!,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slots', program.id] });
      queryClient.invalidateQueries({ queryKey: ['reservations', 'mine'] });
    },
  });

  const slots = (slotsQuery.data ?? []).filter((s) => s.date >= todayStr());

  return (
    <div className="card">
      <h3>
        {program.name} <span className="badge PREPARING">{program.price > 0 ? `${program.price.toLocaleString()}원` : '무료'}</span>
      </h3>
      {reserveMutation.isError && (
        <div className="forbidden-note" style={{ marginBottom: 8 }}>
          {apiErrorMessage(reserveMutation.error)}
        </div>
      )}
      {slots.length === 0 ? (
        <div className="empty-state">예약 가능한 회차가 없습니다.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>일시</th>
              <th>잔여좌석</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => {
              const full = s.bookedCount >= s.capacity;
              return (
                <tr key={s.id}>
                  <td>{slotLabel(s)}</td>
                  <td>
                    {s.bookedCount} / {s.capacity}
                  </td>
                  <td>
                    <button
                      className="btn-secondary primary"
                      disabled={full || reserveMutation.isPending}
                      onClick={() => reserveMutation.mutate(s.id)}
                    >
                      {full ? '마감' : '예약하기'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// 06문서 §5 결제 대기(REQUESTED) 예약에 붙는 모의결제 버튼.
function MockPayButton({ reservationId }: { reservationId: string }) {
  const queryClient = useQueryClient();
  const payMutation = useMutation<unknown, AxiosError<ApiErrorBody>, void>({
    mutationFn: async () => (await api.post(`/payments/${reservationId}/mock-pay`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reservations'] }),
  });
  return (
    <>
      <button className="btn-secondary primary" disabled={payMutation.isPending} onClick={() => payMutation.mutate()}>
        결제하기
      </button>
      {payMutation.isError && (
        <div className="forbidden-note" style={{ marginTop: 6 }}>
          {apiErrorMessage(payMutation.error)}
        </div>
      )}
    </>
  );
}

function CancelButton({ reservationId }: { reservationId: string }) {
  const queryClient = useQueryClient();
  const cancelMutation = useMutation<ReservationRow, AxiosError<ApiErrorBody>, void>({
    mutationFn: async () => (await api.patch<ApiEnvelope<ReservationRow>>(`/reservations/${reservationId}/cancel`)).data.data!,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
    },
  });
  return (
    <button className="btn-danger-outline" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
      취소
    </button>
  );
}

function CheckInButton({ reservationId }: { reservationId: string }) {
  const queryClient = useQueryClient();
  const checkInMutation = useMutation<ReservationRow, AxiosError<ApiErrorBody>, void>({
    mutationFn: async () =>
      (await api.patch<ApiEnvelope<ReservationRow>>(`/reservations/${reservationId}/check-in`)).data.data!,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reservations'] }),
  });
  return (
    <button className="btn-secondary" disabled={checkInMutation.isPending} onClick={() => checkInMutation.mutate()}>
      체크인
    </button>
  );
}

// 06문서 §5 POST /programs/:id/slots — BRANCH_ADMIN 본인 지점 PAID_SESSION 프로그램에 회차 개별 추가.
function SlotManager({ programs }: { programs: ProgramRow[] }) {
  const queryClient = useQueryClient();
  const reservablePrograms = programs.filter((p) => p.pricingType === 'PAID_SESSION');
  const [programId, setProgramId] = useState(reservablePrograms[0]?.id ?? '');
  const [form, setForm] = useState({ date: todayStr(), startTime: '10:00', endTime: '11:00', capacity: '' });

  const slotsQuery = useQuery<ScheduleSlotRow[], AxiosError<ApiErrorBody>>({
    queryKey: ['slots', programId],
    queryFn: async () => (await api.get<ApiEnvelope<ScheduleSlotRow[]>>(`/programs/${programId}/slots`)).data.data ?? [],
    enabled: !!programId,
  });

  const createMutation = useMutation<ScheduleSlotRow, AxiosError<ApiErrorBody>, typeof form>({
    mutationFn: async (dto) => {
      const payload = {
        date: dto.date,
        startTime: dto.startTime,
        endTime: dto.endTime,
        capacity: dto.capacity ? Number(dto.capacity) : undefined,
      };
      return (await api.post<ApiEnvelope<ScheduleSlotRow>>(`/programs/${programId}/slots`, payload)).data.data!;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['slots', programId] }),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!programId || !form.date || !form.startTime || !form.endTime) return;
    createMutation.mutate(form);
  }

  if (reservablePrograms.length === 0) {
    return <div className="empty-state">회차 예약형(PAID_SESSION) 프로그램이 없습니다. 프로그램을 먼저 등록하세요.</div>;
  }

  return (
    <>
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="field">
            <label>프로그램</label>
            <select value={programId} onChange={(e) => setProgramId(e.target.value)}>
              {reservablePrograms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>날짜</label>
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </div>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>시작</label>
            <input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>종료</label>
            <input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>정원(비우면 프로그램 기본 정원)</label>
            <input
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </div>
        </div>
        {createMutation.isError && (
          <div className="forbidden-note" style={{ marginTop: 8 }}>
            {apiErrorMessage(createMutation.error)}
          </div>
        )}
        <button className="btn-secondary" style={{ marginTop: 10 }} type="submit" disabled={createMutation.isPending}>
          회차 추가
        </button>
      </form>

      {(slotsQuery.data?.length ?? 0) > 0 && (
        <table style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>일시</th>
              <th>예약 인원</th>
            </tr>
          </thead>
          <tbody>
            {slotsQuery.data!.map((s) => (
              <tr key={s.id}>
                <td>{slotLabel(s)}</td>
                <td>
                  {s.bookedCount} / {s.capacity}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export function ReservationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'BRANCH_ADMIN';
  const isMember = user?.role === 'MEMBER';

  const reservableProgramsQuery = useApiList<ProgramRow>(
    ['programs', 'reservable'],
    '/programs?status=RUNNING&pricingType=PAID_SESSION',
  );
  const myReservationsQuery = useApiList<ReservationRow>(['reservations', 'mine'], '/reservations');

  const branchProgramsQuery = useApiList<ProgramRow>(['programs'], '/programs');
  const branchReservationsQuery = useApiList<ReservationRow>(['reservations', 'branch'], '/reservations');
  const paymentsQuery = useApiList<PaymentRow>(['payments'], '/payments');

  return (
    <>
      <div className="page-header">
        <h2>예약{isMember ? '' : ' 관리'}</h2>
        <p className="page-desc">
          06문서 기준입니다. 회차 예약형(PAID_SESSION) 프로그램만 대상이며, 결제는 모의결제(Mock Payment)로
          처리됩니다.
        </p>
      </div>

      {isMember && (
        <>
          <h3 className="section-title">예약 가능한 프로그램</h3>
          {reservableProgramsQuery.isError && (
            <div className="forbidden-note">{apiErrorMessage(reservableProgramsQuery.error)}</div>
          )}
          {(reservableProgramsQuery.data?.length ?? 0) === 0 ? (
            <div className="empty-state">예약 가능한 프로그램이 없습니다.</div>
          ) : (
            <div className="card-grid">
              {reservableProgramsQuery.data!.map((p) => (
                <ProgramSlotsCard key={p.id} program={p} />
              ))}
            </div>
          )}

          <div className="detail-section">
            <h3 className="section-title">내 예약 내역</h3>
            {myReservationsQuery.isError && (
              <div className="forbidden-note">{apiErrorMessage(myReservationsQuery.error)}</div>
            )}
            {(myReservationsQuery.data?.length ?? 0) === 0 ? (
              <div className="empty-state">예약 내역이 없습니다.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>프로그램</th>
                    <th>일시</th>
                    <th>상태</th>
                    <th>결제금액</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {myReservationsQuery.data!.map((r) => (
                    <tr key={r.id}>
                      <td>{r.programName ?? '-'}</td>
                      <td>{slotLabel(r.slot)}</td>
                      <td>
                        <span className={`badge ${r.status}`}>{STATUS_LABEL[r.status]}</span>
                      </td>
                      <td>{r.payment ? `${r.payment.amount.toLocaleString()}원` : '무료'}</td>
                      <td>
                        <div className="action-row">
                          {r.status === 'REQUESTED' && r.payment?.status === 'PENDING' && (
                            <MockPayButton reservationId={r.id} />
                          )}
                          {(r.status === 'REQUESTED' || r.status === 'CONFIRMED') && (
                            <CancelButton reservationId={r.id} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {isAdmin && (
        <>
          <div className="detail-section">
            <h3 className="section-title">예약 현황</h3>
            {branchReservationsQuery.isError && (
              <div className="forbidden-note">{apiErrorMessage(branchReservationsQuery.error)}</div>
            )}
            {(branchReservationsQuery.data?.length ?? 0) === 0 ? (
              <div className="empty-state">예약 내역이 없습니다.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>회원</th>
                    <th>프로그램</th>
                    <th>일시</th>
                    <th>상태</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {branchReservationsQuery.data!.map((r) => (
                    <tr key={r.id}>
                      <td>{r.memberName ?? '-'}</td>
                      <td>{r.programName ?? '-'}</td>
                      <td>{slotLabel(r.slot)}</td>
                      <td>
                        <span className={`badge ${r.status}`}>{STATUS_LABEL[r.status]}</span>
                      </td>
                      <td>
                        <div className="action-row">
                          {r.status === 'CONFIRMED' && <CheckInButton reservationId={r.id} />}
                          {(r.status === 'REQUESTED' || r.status === 'CONFIRMED') && (
                            <CancelButton reservationId={r.id} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="detail-section">
            <h3 className="section-title">회차 관리</h3>
            {branchProgramsQuery.isError ? (
              <div className="forbidden-note">{apiErrorMessage(branchProgramsQuery.error)}</div>
            ) : (
              <SlotManager programs={branchProgramsQuery.data ?? []} />
            )}
          </div>

          <div className="detail-section">
            <h3 className="section-title">결제 내역</h3>
            {paymentsQuery.isError && <div className="forbidden-note">{apiErrorMessage(paymentsQuery.error)}</div>}
            {(paymentsQuery.data?.length ?? 0) === 0 ? (
              <div className="empty-state">결제 내역이 없습니다.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>회원</th>
                    <th>프로그램</th>
                    <th>공급가액</th>
                    <th>부가세</th>
                    <th>합계</th>
                    <th>상태</th>
                    <th>승인번호</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsQuery.data!.map((p) => (
                    <tr key={p.id}>
                      <td>{p.memberName ?? '-'}</td>
                      <td>{p.programName ?? '-'}</td>
                      <td>{p.supplyAmount.toLocaleString()}원</td>
                      <td>{p.vat.toLocaleString()}원</td>
                      <td>{p.amount.toLocaleString()}원</td>
                      <td>
                        <span className={`badge ${p.status}`}>{p.status}</span>
                      </td>
                      <td>{p.mockApprovalNo ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}
