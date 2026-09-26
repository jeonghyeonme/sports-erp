import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/use-auth';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import {
  ApiEnvelope,
  CourseEnrollmentRow,
  CourseEnrollmentStatus,
  MemberRow,
  ProgramRow,
  PTSessionRow,
  ReservationRow,
  StaffRow,
} from '../lib/types';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

const STATUS_LABEL: Record<MemberRow['status'], string> = {
  ACTIVE: '활성',
  DORMANT: '휴면',
  WITHDRAWN: '탈퇴',
};

const ENROLLMENT_STATUS_LABEL: Record<CourseEnrollmentStatus, string> = {
  ACTIVE: '수강중',
  COMPLETED: '수료',
  CANCELLED: '취소',
};

const RESERVATION_STATUS_LABEL: Record<ReservationRow['status'], string> = {
  REQUESTED: '결제 대기',
  CONFIRMED: '확정',
  CANCELLED: '취소',
  COMPLETED: '완료',
  NO_SHOW: '노쇼',
};

interface EditForm {
  name: string;
  phone: string;
  birthDate: string;
  gender: string;
  assignedStaffId: string;
  memo: string;
}

function toEditForm(member: MemberRow): EditForm {
  return {
    name: member.name,
    phone: member.phone ?? '',
    birthDate: member.birthDate ?? '',
    gender: member.gender ?? '',
    assignedStaffId: member.assignedStaffId ?? '',
    memo: member.memo ?? '',
  };
}

// ADR-MEM-03 — 수강내역 탭. 예약과 별개로 "이 회원이 이 프로그램을 듣고 있다"는 등록 사실을 관리자가 기록한다.
function EnrollmentsTab({ member, canManage }: { member: MemberRow; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ programId: '', enrolledAt: '', expiresAt: '' });

  const enrollmentsQuery = useApiList<CourseEnrollmentRow>(
    ['members', member.id, 'enrollments'],
    `/members/${member.id}/enrollments`,
  );
  const programsQuery = useApiList<ProgramRow>(['programs', member.branchId], `/programs?branchId=${member.branchId}`);

  const createMutation = useMutation<CourseEnrollmentRow, AxiosError<ApiErrorBody>, typeof form>({
    mutationFn: async (dto) =>
      (
        await api.post<ApiEnvelope<CourseEnrollmentRow>>(`/members/${member.id}/enrollments`, {
          programId: dto.programId,
          enrolledAt: dto.enrolledAt,
          expiresAt: dto.expiresAt || undefined,
        })
      ).data.data!,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', member.id, 'enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['members', member.id] });
      setForm({ programId: '', enrolledAt: '', expiresAt: '' });
      setShowForm(false);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.programId || !form.enrolledAt) return;
    createMutation.mutate(form);
  }

  if (enrollmentsQuery.isLoading) return <div className="loading-state">불러오는 중...</div>;
  if (enrollmentsQuery.isError) {
    return <div className="forbidden-note">{apiErrorMessage(enrollmentsQuery.error)}</div>;
  }
  const rows = enrollmentsQuery.data ?? [];

  return (
    <div>
      {canManage && (
        <div className="action-row" style={{ marginBottom: 12 }}>
          <button className="btn-secondary primary" onClick={() => setShowForm((v) => !v)}>
            + 수강 등록
          </button>
        </div>
      )}
      {showForm && (
        <form className="card" onSubmit={submit} style={{ marginBottom: 12 }}>
          <div className="form-row">
            <div className="field">
              <label>프로그램 *</label>
              <select
                value={form.programId}
                onChange={(e) => setForm({ ...form, programId: e.target.value })}
                required
              >
                <option value="">선택</option>
                {(programsQuery.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>등록일 *</label>
              <input
                type="date"
                value={form.enrolledAt}
                onChange={(e) => setForm({ ...form, enrolledAt: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>만료일(선택)</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </div>
          </div>
          {createMutation.isError && (
            <div className="forbidden-note" style={{ marginTop: 8 }}>
              {apiErrorMessage(createMutation.error)}
            </div>
          )}
          <div className="action-row" style={{ marginTop: 8 }}>
            <button type="submit" className="btn-secondary primary" disabled={createMutation.isPending}>
              등록
            </button>
          </div>
        </form>
      )}
      {rows.length === 0 ? (
        <div className="empty-state">수강내역이 없습니다.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>프로그램</th>
              <th>등록일</th>
              <th>만료일</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.programName ?? '-'}</td>
                <td>{r.enrolledAt}</td>
                <td>{r.expiresAt ?? '-'}</td>
                <td>
                  <span className={`badge ${r.status}`}>{ENROLLMENT_STATUS_LABEL[r.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ADR-MEM-03 — PT 잔여세션 탭. PT_PACKAGE 결제 연동은 범위 제외라 관리자가 구매를 직접 등록하고,
// 세션 사용(차감)은 별도 액션으로 기록한다.
function PTSessionsTab({ member, canManage }: { member: MemberRow; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ programId: '', totalSessions: '', purchasedAt: '' });
  const [noteBySession, setNoteBySession] = useState<Record<string, string>>({});

  const sessionsQuery = useApiList<PTSessionRow>(
    ['members', member.id, 'pt-sessions'],
    `/members/${member.id}/pt-sessions`,
  );
  const programsQuery = useApiList<ProgramRow>(['programs', member.branchId], `/programs?branchId=${member.branchId}`);
  const ptPrograms = (programsQuery.data ?? []).filter((p) => p.pricingType === 'PT_PACKAGE');

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['members', member.id, 'pt-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['members', member.id] });
  }

  const createMutation = useMutation<PTSessionRow, AxiosError<ApiErrorBody>, typeof form>({
    mutationFn: async (dto) =>
      (
        await api.post<ApiEnvelope<PTSessionRow>>(`/members/${member.id}/pt-sessions`, {
          programId: dto.programId,
          totalSessions: Number(dto.totalSessions),
          purchasedAt: dto.purchasedAt,
        })
      ).data.data!,
    onSuccess: () => {
      invalidate();
      setForm({ programId: '', totalSessions: '', purchasedAt: '' });
      setShowForm(false);
    },
  });

  const useMutationHook = useMutation<PTSessionRow, AxiosError<ApiErrorBody>, { sessionId: string; note: string }>({
    mutationFn: async ({ sessionId, note }) =>
      (
        await api.post<ApiEnvelope<PTSessionRow>>(`/members/${member.id}/pt-sessions/${sessionId}/use`, {
          note: note || undefined,
        })
      ).data.data!,
    onSuccess: (_data, { sessionId }) => {
      invalidate();
      setNoteBySession((prev) => ({ ...prev, [sessionId]: '' }));
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.programId || !form.totalSessions || !form.purchasedAt) return;
    createMutation.mutate(form);
  }

  if (sessionsQuery.isLoading) return <div className="loading-state">불러오는 중...</div>;
  if (sessionsQuery.isError) {
    return <div className="forbidden-note">{apiErrorMessage(sessionsQuery.error)}</div>;
  }
  const rows = sessionsQuery.data ?? [];

  return (
    <div>
      {canManage && (
        <div className="action-row" style={{ marginBottom: 12 }}>
          <button className="btn-secondary primary" onClick={() => setShowForm((v) => !v)}>
            + PT 패키지 등록
          </button>
        </div>
      )}
      {showForm && (
        <form className="card" onSubmit={submit} style={{ marginBottom: 12 }}>
          <div className="form-row">
            <div className="field">
              <label>프로그램 *</label>
              <select
                value={form.programId}
                onChange={(e) => setForm({ ...form, programId: e.target.value })}
                required
              >
                <option value="">선택</option>
                {ptPrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>세션 수 *</label>
              <input
                type="number"
                min={1}
                value={form.totalSessions}
                onChange={(e) => setForm({ ...form, totalSessions: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>구매일 *</label>
              <input
                type="date"
                value={form.purchasedAt}
                onChange={(e) => setForm({ ...form, purchasedAt: e.target.value })}
                required
              />
            </div>
          </div>
          {createMutation.isError && (
            <div className="forbidden-note" style={{ marginTop: 8 }}>
              {apiErrorMessage(createMutation.error)}
            </div>
          )}
          <div className="action-row" style={{ marginTop: 8 }}>
            <button type="submit" className="btn-secondary primary" disabled={createMutation.isPending}>
              등록
            </button>
          </div>
        </form>
      )}
      {rows.length === 0 ? (
        <div className="empty-state">PT 세션이 없습니다.</div>
      ) : (
        rows.map((s) => (
          <div className="card" key={s.id} style={{ marginBottom: 12 }}>
            <h3>
              {s.programName ?? '-'}{' '}
              <span className="badge PREPARING">
                {s.remainingSessions} / {s.totalSessions}회 남음
              </span>
            </h3>
            <div className="stat-row">
              <span>구매일</span>
              <strong>{s.purchasedAt}</strong>
            </div>
            {s.logs.length > 0 && (
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8, marginBottom: 0 }}>
                사용 이력: {s.logs.map((l) => l.usedAt.slice(0, 10)).join(', ')}
              </p>
            )}
            {canManage && (
              <form
                className="action-row"
                style={{ marginTop: 12 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  useMutationHook.mutate({ sessionId: s.id, note: noteBySession[s.id] ?? '' });
                }}
              >
                <input
                  placeholder="메모(선택)"
                  value={noteBySession[s.id] ?? ''}
                  onChange={(e) => setNoteBySession((prev) => ({ ...prev, [s.id]: e.target.value }))}
                  style={{ width: 160 }}
                />
                <button
                  type="submit"
                  className="btn-secondary"
                  disabled={useMutationHook.isPending || s.remainingSessions <= 0}
                >
                  세션 사용
                </button>
              </form>
            )}
            {useMutationHook.isError && useMutationHook.variables?.sessionId === s.id && (
              <div className="forbidden-note" style={{ marginTop: 8 }}>
                {apiErrorMessage(useMutationHook.error)}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ADR-MEM-03 — 예약·결제 내역 탭. 신규 API 없이 GET /reservations?memberId=를 재사용한다
// (각 예약 응답에 payment가 이미 nested로 포함돼 있어 그대로 표시하면 된다).
function MemberReservationsTab({ memberId }: { memberId: string }) {
  const reservationsQuery = useQuery<ReservationRow[], AxiosError<ApiErrorBody>>({
    queryKey: ['reservations', 'byMember', memberId],
    queryFn: async () =>
      (await api.get<ApiEnvelope<ReservationRow[]>>(`/reservations?memberId=${memberId}`)).data.data ?? [],
  });

  if (reservationsQuery.isLoading) return <div className="loading-state">불러오는 중...</div>;
  if (reservationsQuery.isError) {
    return <div className="forbidden-note">{apiErrorMessage(reservationsQuery.error)}</div>;
  }
  const rows = reservationsQuery.data ?? [];
  if (rows.length === 0) return <div className="empty-state">예약·결제 내역이 없습니다.</div>;

  return (
    <table>
      <thead>
        <tr>
          <th>프로그램</th>
          <th>회차</th>
          <th>상태</th>
          <th>결제금액</th>
          <th>결제상태</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{r.programName ?? '-'}</td>
            <td>{r.slot ? `${r.slot.date} ${r.slot.startTime}~${r.slot.endTime}` : '-'}</td>
            <td>
              <span className={`badge ${r.status}`}>{RESERVATION_STATUS_LABEL[r.status]}</span>
            </td>
            <td>{r.payment ? `${r.payment.amount.toLocaleString()}원` : '-'}</td>
            <td>{r.payment?.status ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MemberDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [tab, setTab] = useState<'enrollments' | 'pt' | 'payments'>('enrollments');

  const memberQuery = useQuery<MemberRow, AxiosError<ApiErrorBody>>({
    queryKey: ['members', id],
    queryFn: async () => (await api.get<ApiEnvelope<MemberRow>>(`/members/${id}`)).data.data!,
  });
  const staffQuery = useApiList<StaffRow>(['staff'], '/staff');

  const updateMutation = useMutation<MemberRow, AxiosError<ApiErrorBody>, EditForm>({
    mutationFn: async (dto) => {
      const payload = {
        name: dto.name,
        phone: dto.phone || undefined,
        birthDate: dto.birthDate || undefined,
        gender: dto.gender || undefined,
        assignedStaffId: dto.assignedStaffId || undefined,
        memo: dto.memo || undefined,
      };
      return (await api.patch<ApiEnvelope<MemberRow>>(`/members/${id}`, payload)).data.data!;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['members', id], updated);
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setEditing(false);
    },
  });

  const statusMutation = useMutation<MemberRow, AxiosError<ApiErrorBody>, MemberRow['status']>({
    mutationFn: async (status) =>
      (await api.patch<ApiEnvelope<MemberRow>>(`/members/${id}/status`, { status })).data.data!,
    onSuccess: (updated) => {
      queryClient.setQueryData(['members', id], updated);
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });

  function submitEdit(e: FormEvent) {
    e.preventDefault();
    if (!form || !form.name.trim()) return;
    updateMutation.mutate(form);
  }

  if (memberQuery.isLoading) return <div className="loading-state">불러오는 중...</div>;
  if (memberQuery.isError) {
    return <div className="forbidden-note">{apiErrorMessage(memberQuery.error)}</div>;
  }
  const member = memberQuery.data!;
  // ADR-MEM-03 — 등록·차감 같은 쓰기 액션은 백엔드와 동일하게 본인 지점 BRANCH_ADMIN만(컨트롤러가 이미 강제,
  // 화면에서는 403을 굳이 유도하지 않도록 버튼 자체를 숨긴다).
  const canManage = user?.role === 'BRANCH_ADMIN' && user.branchId === member.branchId;

  return (
    <>
      <div className="page-header">
        <Link className="back-link" to="/members">
          ← 회원 목록으로
        </Link>
        <h2>{member.name}</h2>
        <p className="page-desc" style={{ marginBottom: 0 }}>
          {member.memberNo} · {member.branchName}
        </p>
      </div>

      <div className="card">
        {!editing ? (
          <>
            <div className="stat-row">
              <span>연락처</span>
              <strong>{member.phone ?? '-'}</strong>
            </div>
            <div className="stat-row">
              <span>생년월일</span>
              <strong>{member.birthDate ?? '-'}</strong>
            </div>
            <div className="stat-row">
              <span>담당 직원</span>
              <strong>{member.assignedStaffName ?? '회원권만(미배정)'}</strong>
            </div>
            <div className="stat-row">
              <span>메모</span>
              <strong>{member.memo ?? '-'}</strong>
            </div>
            <div className="stat-row">
              <span>상태</span>
              <span className={`badge ${member.status}`}>{STATUS_LABEL[member.status]}</span>
            </div>
            <div className="stat-row">
              <span>수강중</span>
              <strong>{member.enrollmentCount ?? 0}건</strong>
            </div>
            <div className="stat-row">
              <span>PT 잔여세션 합계</span>
              <strong>{member.ptRemainingTotal ?? 0}회</strong>
            </div>
            <div className="stat-row" style={{ marginBottom: 0 }}>
              <span>최근 결제일</span>
              <strong>{member.lastPaymentAt ? member.lastPaymentAt.slice(0, 10) : '-'}</strong>
            </div>

            {statusMutation.isError && (
              <div className="forbidden-note" style={{ marginTop: 12 }}>
                {apiErrorMessage(statusMutation.error)}
              </div>
            )}

            <div className="action-row" style={{ marginTop: 14 }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  // 편집 폼은 "편집을 시작하는 시점"의 최신 회원 정보로 채운다(effect로 미리 복사하지 않음).
                  setForm(toEditForm(member));
                  setEditing(true);
                }}
              >
                정보 수정
              </button>
              {(['ACTIVE', 'DORMANT', 'WITHDRAWN'] as const)
                .filter((s) => s !== member.status)
                .map((s) => (
                  <button
                    key={s}
                    className={s === 'WITHDRAWN' ? 'btn-danger-outline' : 'btn-secondary'}
                    disabled={statusMutation.isPending}
                    onClick={() => statusMutation.mutate(s)}
                  >
                    {STATUS_LABEL[s]}(으)로 전환
                  </button>
                ))}
            </div>
          </>
        ) : (
          form && (
            <form onSubmit={submitEdit}>
              <div className="form-row">
                <div className="field">
                  <label>이름 *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="field">
                  <label>연락처</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="form-row" style={{ marginTop: 12 }}>
                <div className="field">
                  <label>생년월일</label>
                  <input
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>성별</label>
                  <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                    <option value="">선택 안 함</option>
                    <option value="M">남성</option>
                    <option value="F">여성</option>
                  </select>
                </div>
                <div className="field">
                  <label>담당 직원</label>
                  <select
                    value={form.assignedStaffId}
                    onChange={(e) => setForm({ ...form, assignedStaffId: e.target.value })}
                  >
                    <option value="">회원권만(미배정)</option>
                    {(staffQuery.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label>메모</label>
                <textarea rows={2} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
              </div>

              {updateMutation.isError && (
                <div className="forbidden-note" style={{ marginTop: 12 }}>
                  {apiErrorMessage(updateMutation.error)}
                </div>
              )}

              <div className="action-row" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setForm(toEditForm(member));
                    setEditing(false);
                  }}
                >
                  취소
                </button>
                <button type="submit" className="btn-secondary primary" disabled={updateMutation.isPending}>
                  저장
                </button>
              </div>
            </form>
          )
        )}
      </div>

      <div className="detail-section" style={{ marginTop: 22 }}>
        <div className="wf-tab-row" style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          <button
            className={tab === 'enrollments' ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setTab('enrollments')}
          >
            수강내역
          </button>
          <button className={tab === 'pt' ? 'filter-chip active' : 'filter-chip'} onClick={() => setTab('pt')}>
            PT 잔여세션
          </button>
          <button
            className={tab === 'payments' ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setTab('payments')}
          >
            예약·결제 내역
          </button>
        </div>
        {tab === 'enrollments' && <EnrollmentsTab member={member} canManage={canManage} />}
        {tab === 'pt' && <PTSessionsTab member={member} canManage={canManage} />}
        {tab === 'payments' && <MemberReservationsTab memberId={member.id} />}
      </div>
    </>
  );
}
