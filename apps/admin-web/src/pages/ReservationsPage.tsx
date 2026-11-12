import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/use-auth';
import { useCan } from '../lib/use-can';
import { apiErrorMessage, useApiList, useApiPage, ApiError } from '../lib/use-api-list';
import { ExportCsvButton } from '../components/ExportCsvButton';
import { fetchAllPages, kstDateStamp } from '../lib/csv';
import { PAYMENT_COLUMNS } from '../lib/export-columns';
import { Pager } from '../components/Pager';
import { WeeklyTimetable } from '../components/WeeklyTimetable';
import { Modal } from '../components/Modal';
import { ApiEnvelope, PaymentRow, ProgramRow, ReservationRow, ReservationStatus, ScheduleSlotRow } from '../lib/types';

import { useToast } from '../lib/use-toast';
import { kstToday } from '../lib/kst-date';
import { PAYMENT_STATUS_LABEL } from '../lib/status-labels';
import { useDebouncedValue } from '../lib/use-debounced';

const STATUS_LABEL: Record<ReservationStatus, string> = {
  REQUESTED: '결제 대기',
  CONFIRMED: '확정',
  CANCELLED: '취소',
  COMPLETED: '완료',
  NO_SHOW: '노쇼',
};

const PAGE_SIZE = 20;

function slotLabel(slot?: ScheduleSlotRow): string {
  if (!slot) return '-';
  return `${slot.date} ${slot.startTime}~${slot.endTime}`;
}

// 예약및결제 A-5 GET /programs/:id/slots — 프로그램 하나의 회차 목록 + 예약하기 버튼(회원 전용).
function CancelButton({ reservationId }: { reservationId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const cancelMutation = useMutation<ReservationRow, ApiError, void>({
    mutationFn: async () => (await api.patch<ApiEnvelope<ReservationRow>>(`/reservations/${reservationId}/cancel`)).data.data!,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      toast.success('예약을 취소했습니다.');
    },
    // 목록 안의 작은 버튼이라 인라인으로 보일 자리가 없다 — 오류는 Toast로(B5-3).
    onError: (err) => toast.error(apiErrorMessage(err) ?? '예약을 취소하지 못했습니다.'),
  });
  return (
    <button className="btn-danger-outline" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
      취소
    </button>
  );
}

function CheckInButton({ reservationId }: { reservationId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const checkInMutation = useMutation<ReservationRow, ApiError, void>({
    mutationFn: async () =>
      (await api.patch<ApiEnvelope<ReservationRow>>(`/reservations/${reservationId}/check-in`)).data.data!,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast.success('체크인했습니다.');
    },
    onError: (err) => toast.error(apiErrorMessage(err) ?? '체크인하지 못했습니다.'),
  });
  return (
    <button className="btn-secondary" disabled={checkInMutation.isPending} onClick={() => checkInMutation.mutate()}>
      체크인
    </button>
  );
}

// 강사프로그램게시 A-5 POST /programs/:id/slots — BRANCH_ADMIN 본인 지점 회차 강습·PT 프로그램에 회차 개별 추가.
// PT 회차는 정원을 비우면 1명(1:1), 회원은 산 PT 횟수로 예약한다(예약및결제 ADR-RSV-09).
// D73 — 등록 폼은 쌓이는 예약 목록 아래가 아니라 머리글 "+ 회차 등록" 버튼의 모달로(스크롤 없이 닿게).
function SlotCreateModal({ programs, onClose }: { programs: ProgramRow[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const reservablePrograms = programs.filter((p) => p.pricingType !== 'FREE_ACCESS'); // PT 포함(ADR-RSV-09)
  const [programId, setProgramId] = useState(reservablePrograms[0]?.id ?? '');
  const [form, setForm] = useState({ date: kstToday(), startTime: '10:00', endTime: '11:00', capacity: '' });
  const createMutation = useMutation<ScheduleSlotRow, ApiError, typeof form>({
    mutationFn: async (dto) => {
      const payload = {
        date: dto.date,
        startTime: dto.startTime,
        endTime: dto.endTime,
        capacity: dto.capacity ? Number(dto.capacity) : undefined,
      };
      return (await api.post<ApiEnvelope<ScheduleSlotRow>>(`/programs/${programId}/slots`, payload)).data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slots', programId] });
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      toast.success('회차를 등록했습니다.');
      onClose();
    },
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!programId || !form.date || !form.startTime || !form.endTime) return;
    createMutation.mutate(form);
  }
  return (
    <Modal title="회차 등록" onClose={onClose}>
      {reservablePrograms.length === 0 ? (
        <div className="empty-state">회차 예약형(PAID_SESSION) 프로그램이 없습니다. 프로그램을 먼저 등록하세요.</div>
      ) : (
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
                value={form.capacity} inputMode="numeric"
                onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
              />
            </div>
          </div>
          {createMutation.isError && (
            <div className="forbidden-note" style={{ marginTop: 8 }}>
              {apiErrorMessage(createMutation.error)}
            </div>
          )}
          <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              취소
            </button>
            <button className="btn-secondary primary" type="submit" disabled={createMutation.isPending}>
              회차 추가
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// 프로그램별 회차 목록(예약 인원/정원) — 조회만. 등록은 SlotCreateModal.
function SlotList({ programs }: { programs: ProgramRow[] }) {
  const reservablePrograms = programs.filter((p) => p.pricingType !== 'FREE_ACCESS'); // PT 포함(ADR-RSV-09)
  const [programId, setProgramId] = useState(reservablePrograms[0]?.id ?? '');
  const slotsQuery = useQuery<ScheduleSlotRow[], ApiError>({
    queryKey: ['slots', programId],
    queryFn: async () => (await api.get<ApiEnvelope<ScheduleSlotRow[]>>(`/programs/${programId}/slots`)).data.data ?? [],
    enabled: !!programId,
  });
  if (reservablePrograms.length === 0) {
    return <div className="empty-state">회차 예약형(PAID_SESSION) 프로그램이 없습니다. 프로그램을 먼저 등록하세요.</div>;
  }
  return (
    <>
      <div className="field" style={{ maxWidth: 260 }}>
        <label>프로그램</label>
        <select value={programId} aria-label="회차 목록 프로그램" onChange={(e) => setProgramId(e.target.value)}>
          {reservablePrograms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {slotsQuery.isError && <div className="forbidden-note">{apiErrorMessage(slotsQuery.error)}</div>}
      {slotsQuery.isSuccess && slotsQuery.data.length === 0 && <div className="empty-state">이 프로그램의 회차가 없습니다.</div>}
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
  const can = useCan();
  const isAdmin = user?.role === 'BRANCH_ADMIN';

  // D43 — 예약·결제는 쪽 단위, 최근 것부터(B8 사용자 결정). 무효화는 ['reservations']·['payments'] 접두어로 그대로 된다.
  const [branchPage, setBranchPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);

  const branchProgramsQuery = useApiList<ProgramRow>(['programs'], '/programs');
  // ADR-RSV-08(log/125 F5) — 현장은 "오늘 예약"부터 본다. 회차 날짜 범위·상태로 거르고 회차 시각순으로 받는다.
  const [filter, setFilter] = useState(() => ({ dateFrom: kstToday(), dateTo: kstToday(), status: '' }));
  const changeFilter = (next: Partial<typeof filter>) => {
    setFilter((f) => ({ ...f, ...next }));
    setBranchPage(1);
  };
  // D74 2차(log/204) — 회원 이름·회원번호·프로그램으로 찾는다(체크인할 사람 찾기). 치는 대로, 바뀌면 1쪽부터.
  const [searchInput, setSearchInput] = useState('');
  const q = useDebouncedValue(searchInput.trim());
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    setBranchPage(1);
  }
  const filterQuery =
    `&dateFrom=${filter.dateFrom}&dateTo=${filter.dateTo}` +
    (filter.status ? `&status=${filter.status}` : '') +
    (q ? `&q=${encodeURIComponent(q)}` : '');
  const branchReservationsQuery = useApiPage<ReservationRow>(
    ['reservations', 'branch', branchPage, filter, q],
    `/reservations?page=${branchPage}&limit=${PAGE_SIZE}${filterQuery}`,
    { enabled: isAdmin },
  );
  const paymentsQuery = useApiPage<PaymentRow>(['payments', paymentPage], `/payments?page=${paymentPage}&limit=${PAGE_SIZE}`, {
    enabled: isAdmin,
  });
  const branchRows = branchReservationsQuery.data?.rows ?? [];
  const paymentRows = paymentsQuery.data?.rows ?? [];
  const [showSlotCreate, setShowSlotCreate] = useState(false);

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2>예약 관리</h2>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            예약및결제 문서 기준입니다. 회차 예약형(PAID_SESSION) 프로그램만 대상이며, 결제는 모의결제(Mock Payment)로
            처리됩니다.
          </p>
        </div>
        {/* D73 — 회차 등록은 머리글 버튼 + 모달. 강사프로그램게시 A-5: 지점 관리자, program CREATE(D60) */}
        {isAdmin && can('program', 'CREATE') && (
          <button className="btn-secondary primary" style={{ flexShrink: 0 }} onClick={() => setShowSlotCreate(true)}>
            + 회차 등록
          </button>
        )}
      </div>
      {showSlotCreate && (
        <SlotCreateModal programs={branchProgramsQuery.data ?? []} onClose={() => setShowSlotCreate(false)} />
      )}

      {isAdmin && (
        <>
          <div className="detail-section">
            <h3 className="section-title">예약 현황</h3>
            <div className="action-row" style={{ gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input
                className="search-input"
                type="search"
                placeholder="회원 이름 · 회원번호 · 프로그램"
                aria-label="예약 검색"
                value={searchInput}
                maxLength={50}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <input
                type="date"
                aria-label="회차 시작일"
                value={filter.dateFrom}
                onChange={(e) => e.target.value && changeFilter({ dateFrom: e.target.value })}
              />
              <span>~</span>
              <input
                type="date"
                aria-label="회차 종료일"
                value={filter.dateTo}
                onChange={(e) => e.target.value && changeFilter({ dateTo: e.target.value })}
              />
              <select className="role-select" aria-label="예약 상태" value={filter.status} onChange={(e) => changeFilter({ status: e.target.value })}>
                <option value="">전체 상태</option>
                {(Object.keys(STATUS_LABEL) as ReservationStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <button className="btn-secondary" onClick={() => changeFilter({ dateFrom: kstToday(), dateTo: kstToday() })}>
                오늘
              </button>
            </div>
            {branchReservationsQuery.isError && (
              <div className="forbidden-note">{apiErrorMessage(branchReservationsQuery.error)}</div>
            )}
            <Pager
              page={branchPage}
              pageSize={PAGE_SIZE}
              total={branchReservationsQuery.data?.total ?? 0}
              onChange={setBranchPage}
              disabled={branchReservationsQuery.isFetching}
            />
            {branchRows.length === 0 ? (
              <div className="empty-state">조건에 맞는 예약이 없습니다.</div>
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
                  {branchRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.memberName ?? '-'}</td>
                      <td>{r.programName ?? '-'}</td>
                      <td>{slotLabel(r.slot)}</td>
                      <td>
                        <span className={`badge ${r.status}`}>{STATUS_LABEL[r.status]}</span>
                      </td>
                      <td>
                        {/* D60 — 체크인·취소는 예약 수정 권한 */}
                        {can('reservation', 'UPDATE') && (
                          <div className="action-row">
                            {/* ADR-RSV-08 — 체크인은 회차 당일(KST)만(서버도 409 CHECK_IN_NOT_TODAY) */}
                            {r.status === 'CONFIRMED' && r.slot?.date === kstToday() && <CheckInButton reservationId={r.id} />}
                            {(r.status === 'REQUESTED' || r.status === 'CONFIRMED') && (
                              <CancelButton reservationId={r.id} />
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="detail-section">
            <h3 className="section-title">주간 시간표</h3>
            {!branchProgramsQuery.isError && <WeeklyTimetable programs={branchProgramsQuery.data ?? []} />}
          </div>

          <div className="detail-section">
            <h3 className="section-title">회차 목록</h3>
            {branchProgramsQuery.isError ? (
              <div className="forbidden-note">{apiErrorMessage(branchProgramsQuery.error)}</div>
            ) : (
              <SlotList programs={branchProgramsQuery.data ?? []} />
            )}
          </div>

          <div className="detail-section">
            <div className="action-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="section-title">결제 내역</h3>
              <ExportCsvButton
                filename={`payments_${kstDateStamp()}.csv`}
                feature="payment"
                columns={PAYMENT_COLUMNS}
                disabled={(paymentsQuery.data?.total ?? 0) === 0}
                load={() => fetchAllPages<PaymentRow>('/payments', new URLSearchParams({ export: 'true' }))}
              />
            </div>
            {paymentsQuery.isError && <div className="forbidden-note">{apiErrorMessage(paymentsQuery.error)}</div>}
            {paymentRows.length === 0 ? (
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
                  {paymentRows.map((p) => (
                    <tr key={p.id}>
                      <td>{p.memberName ?? '-'}</td>
                      <td>
                        {p.programName ?? '-'}
                        {p.kind === 'PT_PACKAGE' && <span className="muted"> · PT 패키지 구매</span>}
                      </td>
                      <td>{p.supplyAmount.toLocaleString()}원</td>
                      <td>{p.vat.toLocaleString()}원</td>
                      <td>{p.amount.toLocaleString()}원</td>
                      <td>
                        <span className={`badge ${p.status}`}>{PAYMENT_STATUS_LABEL[p.status] ?? p.status}</span>
                      </td>
                      <td>{p.mockApprovalNo ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Pager
              page={paymentPage}
              pageSize={PAGE_SIZE}
              total={paymentsQuery.data?.total ?? 0}
              onChange={setPaymentPage}
              disabled={paymentsQuery.isFetching}
            />
          </div>
        </>
      )}
    </>
  );
}
