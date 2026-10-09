import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/use-auth';
import { useToast } from '../lib/use-toast';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { Modal } from '../components/Modal';
import { ApiEnvelope, BranchSummary, StaffAssignmentRow, StaffRow } from '../lib/types';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

const STATUS_LABEL: Record<NonNullable<StaffRow['status']>, string> = {
  ACTIVE: '재직',
  ON_LEAVE: '휴직',
  RESIGNED: '퇴사',
};
const DAY_LABEL = ['일', '월', '화', '수', '목', '금', '토'];
const EMPLOYMENT_TYPES = ['정규직', '계약직', '파트타임'];

function offDaysText(days: number[] | undefined): string {
  return days && days.length > 0 ? [...days].sort().map((d) => DAY_LABEL[d]).join('·') : '-';
}

// ── 지점 관리자: 일상 정보 수정(PATCH /staff/:id, 인사정보관리 A-5 — 지점은 여기서 못 바꾼다) ──

interface EditForm {
  name: string;
  phone: string;
  position: string;
  employmentType: string;
  offDays: number[];
}

function toEditForm(s: StaffRow): EditForm {
  return {
    name: s.name,
    phone: s.phone ?? '',
    position: s.position ?? '',
    employmentType: s.employmentType ?? '정규직',
    offDays: s.offDays ?? [],
  };
}

function EditStaffForm({ staff, onDone }: { staff: StaffRow; onDone: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  // 편집 폼은 "편집을 시작하는 시점"의 값으로 채운다(effect로 복사하지 않음, admin-web CLAUDE.md).
  const [form, setForm] = useState<EditForm>(() => toEditForm(staff));
  const partTime = form.employmentType === '파트타임';

  const updateMutation = useMutation<StaffRow, AxiosError<ApiErrorBody>, EditForm>({
    mutationFn: async (dto) =>
      (
        await api.patch<ApiEnvelope<StaffRow>>(`/staff/${staff.id}`, {
          name: dto.name.trim(),
          phone: dto.phone,
          position: dto.position,
          employmentType: dto.employmentType,
          // ATT-T05 — 파트타임은 정기 휴무 요일을 쓰지 않는다(서버도 비운다).
          offDays: dto.employmentType === '파트타임' ? [] : dto.offDays,
        })
      ).data.data!,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success(`${updated.name}님의 정보를 저장했습니다.`);
      onDone();
    },
  });

  const toggleDay = (d: number) =>
    setForm((f) => ({ ...f, offDays: f.offDays.includes(d) ? f.offDays.filter((x) => x !== d) : [...f.offDays, d] }));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    updateMutation.mutate(form);
  }

  return (
    <form onSubmit={submit}>
      <div className="form-row">
        <div className="field">
          <label>이름 *</label>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </div>
        <div className="field">
          <label>연락처</label>
          <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
      </div>
      <div className="form-row" style={{ marginTop: 12 }}>
        <div className="field">
          <label>직급</label>
          <input value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} />
        </div>
        <div className="field">
          <label>고용형태</label>
          <select
            value={form.employmentType}
            onChange={(e) => setForm((f) => ({ ...f, employmentType: e.target.value }))}
          >
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field" style={{ marginTop: 12 }}>
        <label>정기 휴무 요일{partTime ? ' — 파트타임은 쓰지 않습니다' : ''}</label>
        <div className="action-row">
          {DAY_LABEL.map((label, d) => (
            <button
              key={label}
              type="button"
              disabled={partTime}
              className={!partTime && form.offDays.includes(d) ? 'filter-chip active' : 'filter-chip'}
              onClick={() => toggleDay(d)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {updateMutation.isError && (
        <div className="forbidden-note" style={{ marginTop: 12 }}>
          {apiErrorMessage(updateMutation.error)}
        </div>
      )}

      <div className="action-row" style={{ marginTop: 16 }}>
        <button type="submit" className="btn-secondary primary" disabled={updateMutation.isPending}>
          저장
        </button>
        <button type="button" className="btn-secondary" onClick={onDone}>
          취소
        </button>
      </div>
    </form>
  );
}

// ADR-STF-04·06 — 파견 발령·퇴사로 담당이 풀린 회원은 새 담당을 정해야 하는 정보라 닫을 때까지 남는 warning으로 보인다.
interface ReleasedResult extends StaffRow {
  unassignedMembers: Array<{ id: string; name: string }>;
}

function releasedMembersNotice(released: ReleasedResult['unassignedMembers'], whoDecides: string): string | null {
  if (released.length === 0) return null;
  const names = released
    .slice(0, 5)
    .map((m) => m.name)
    .join(', ');
  return `회원 ${released.length}명의 담당이 풀렸습니다: ${names}${released.length > 5 ? ' 외' : ''}.\n${whoDecides}`;
}

// ── 지점 관리자: 퇴사 처리(PATCH /staff/:id/resign — 계정 비활성화·파견 종료가 한 트랜잭션, ADR-STF-01) ──

function ResignModal({ staff, onClose }: { staff: StaffRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const resignMutation = useMutation<ReleasedResult, AxiosError<ApiErrorBody>>({
    mutationFn: async () => (await api.patch<ApiEnvelope<ReleasedResult>>(`/staff/${staff.id}/resign`)).data.data!,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast.success(`${updated.name}님을 퇴사 처리했습니다(${updated.resignDate}).`);
      const notice = releasedMembersNotice(updated.unassignedMembers, '회원 상세에서 새 담당 직원을 정해 주세요.');
      if (notice) toast.warning(notice);
      onClose();
    },
  });

  return (
    <Modal title="퇴사 처리" onClose={onClose}>
      <p style={{ marginTop: 0 }}>
        <strong>{staff.name}</strong>({staff.staffCode})님을 오늘 날짜로 퇴사 처리합니다.
      </p>
      <ul className="page-desc" style={{ paddingLeft: 18 }}>
        <li>로그인 계정이 바로 비활성화됩니다(다음 요청부터 접근 차단).</li>
        <li>지금 파견이 오늘 날짜로 끝납니다.</li>
        <li>이 직원이 담당하던 회원은 담당이 풀립니다(회원권만 남음). 새 담당은 회원 상세에서 정합니다.</li>
        <li>되돌리는 기능이 없습니다. 다시 일하게 되면 본사가 새로 채용합니다.</li>
      </ul>
      {resignMutation.isError && <div className="forbidden-note">{apiErrorMessage(resignMutation.error)}</div>}
      <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
        <button type="button" className="btn-secondary" onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          className="btn-danger-outline"
          disabled={resignMutation.isPending}
          onClick={() => resignMutation.mutate()}
        >
          퇴사 처리
        </button>
      </div>
    </Modal>
  );
}

// ── 본사: 파견 발령(POST /staff/:id/assignments — ADR-STF-01·04, 종료 지점 제외 log/090) ──

function AssignModal({ staff, onClose }: { staff: StaffRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [branchId, setBranchId] = useState('');
  const [note, setNote] = useState('');
  const branchesQuery = useApiList<BranchSummary>(['branches'], '/branches');
  const branches = (branchesQuery.data ?? []).filter(
    (b) => b.id !== staff.branchId && b.contractStatus !== 'TERMINATED',
  );

  const assignMutation = useMutation<ReleasedResult, AxiosError<ApiErrorBody>>({
    mutationFn: async () =>
      (
        await api.post<ApiEnvelope<ReleasedResult>>(`/staff/${staff.id}/assignments`, {
          branchId,
          note: note.trim() || undefined,
        })
      ).data.data!,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      toast.success(`${updated.name}님을 ${updated.branchName}으로 발령했습니다.`);
      const notice = releasedMembersNotice(
        updated.unassignedMembers,
        '그 지점 관리자가 회원 상세에서 새 담당 직원을 정해야 합니다.',
      );
      if (notice) toast.warning(notice);
      onClose();
    },
  });

  return (
    <Modal title="파견 발령" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (branchId) assignMutation.mutate();
        }}
      >
        <p style={{ marginTop: 0 }}>
          <strong>{staff.name}</strong>님을 {staff.branchName}에서 다른 지점으로 보냅니다.
        </p>
        <div className="field">
          <label>새 파견 지점 *</label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
            <option value="">지점 선택</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.contractStatus === 'RENEWAL_DUE' ? ' (갱신 임박)' : b.contractStatus === 'EXPIRED' ? ' (만료)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>메모</label>
          <input value={note} placeholder="발령 사유 등" onChange={(e) => setNote(e.target.value)} />
        </div>
        <ul className="page-desc" style={{ paddingLeft: 18 }}>
          <li>지금 파견은 오늘로 끝나고 새 파견이 오늘부터 시작됩니다.</li>
          <li>예전 지점 회원의 담당과 강사 프로필 연결이 풀립니다.</li>
          <li>재로그인 없이 다음 요청부터 새 지점 데이터를 봅니다. 계약 종료 지점은 고를 수 없습니다.</li>
        </ul>
        {assignMutation.isError && <div className="forbidden-note">{apiErrorMessage(assignMutation.error)}</div>}
        <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn-secondary primary" disabled={!branchId || assignMutation.isPending}>
            발령
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── 파견 이력(GET /staff/:id/assignments — 인사정보관리 A-8 "파견 이력 UI" 해소) ──

function AssignmentHistory({ staffId }: { staffId: string }) {
  // 서버가 최근 파견부터, 지점명을 붙여 준다(지점 관리자는 다른 지점 목록을 못 보므로, log/090).
  const historyQuery = useApiList<StaffAssignmentRow>(['staff', staffId, 'assignments'], `/staff/${staffId}/assignments`);
  const rows = historyQuery.data ?? [];

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>
        파견 이력
      </h3>
      {historyQuery.isError && <div className="forbidden-note">{apiErrorMessage(historyQuery.error)}</div>}
      {historyQuery.isLoading && <div className="loading-state">불러오는 중...</div>}
      {rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>지점</th>
              <th>시작일</th>
              <th>종료일</th>
              <th>메모</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>{a.branchName}</td>
                <td>{a.startDate}</td>
                <td>{a.endDate ?? <span className="badge ACTIVE">파견 중</span>}</td>
                <td>{a.note ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function StaffDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [modal, setModal] = useState<'resign' | 'assign' | null>(null);

  const staffQuery = useQuery<StaffRow, AxiosError<ApiErrorBody>>({
    queryKey: ['staff', 'detail', id],
    queryFn: async () => (await api.get<ApiEnvelope<StaffRow>>(`/staff/${id}`)).data.data!,
  });

  if (staffQuery.isLoading) return <div className="loading-state">불러오는 중...</div>;
  if (staffQuery.isError) return <div className="forbidden-note">{apiErrorMessage(staffQuery.error)}</div>;
  const staff = staffQuery.data!;
  const active = staff.status !== 'RESIGNED';
  // 인사 권한 분리(CLAUDE.md) — 버튼은 API 권한과 같게 보인다. 본인 퇴사 처리는 자기 접근을 끊으므로 숨긴다.
  const isOwnBranchAdmin = user?.role === 'BRANCH_ADMIN' && user.branchId === staff.branchId;
  const canEdit = isOwnBranchAdmin && active;
  const canResign = isOwnBranchAdmin && active && user?.staffId !== staff.id;
  const canAssign = user?.role === 'SUPER_ADMIN' && active;

  return (
    <>
      <div className="page-header">
        <Link className="back-link" to="/staff">
          ← 직원 목록으로
        </Link>
        <h2>{staff.name}</h2>
        <p className="page-desc" style={{ marginBottom: 0 }}>
          {staff.staffCode} · {staff.branchName}
          {active ? ' 파견 중' : ' (퇴사)'}
        </p>
      </div>

      <div className="card">
        {editing ? (
          <EditStaffForm staff={staff} onDone={() => setEditing(false)} />
        ) : (
          <>
            <div className="stat-row">
              <span>상태</span>
              <span className={`badge ${staff.status === 'RESIGNED' ? 'WITHDRAWN' : 'ACTIVE'}`}>
                {STATUS_LABEL[staff.status ?? 'ACTIVE']}
              </span>
            </div>
            <div className="stat-row">
              <span>직급</span>
              <strong>{staff.position || '-'}</strong>
            </div>
            <div className="stat-row">
              <span>고용형태</span>
              <strong>{staff.employmentType || '-'}</strong>
            </div>
            <div className="stat-row">
              <span>연락처</span>
              <strong>{staff.phone || '-'}</strong>
            </div>
            <div className="stat-row">
              <span>정기 휴무</span>
              <strong>{offDaysText(staff.offDays)}</strong>
            </div>
            <div className="stat-row" style={staff.resignDate ? undefined : { marginBottom: 0 }}>
              <span>입사일</span>
              <strong>{staff.hireDate}</strong>
            </div>
            {staff.resignDate && (
              <div className="stat-row" style={{ marginBottom: 0 }}>
                <span>퇴사일</span>
                <strong>{staff.resignDate}</strong>
              </div>
            )}

            {(canEdit || canResign || canAssign) && (
              <div className="action-row" style={{ marginTop: 14 }}>
                {canEdit && (
                  <button className="btn-secondary" onClick={() => setEditing(true)}>
                    정보 수정
                  </button>
                )}
                {canAssign && (
                  <button className="btn-secondary primary" onClick={() => setModal('assign')}>
                    파견 발령
                  </button>
                )}
                {canResign && (
                  <button className="btn-danger-outline" onClick={() => setModal('resign')}>
                    퇴사 처리
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {user?.role !== 'STAFF' && <AssignmentHistory staffId={staff.id} />}

      {modal === 'resign' && <ResignModal staff={staff} onClose={() => setModal(null)} />}
      {modal === 'assign' && <AssignModal staff={staff} onClose={() => setModal(null)} />}
    </>
  );
}
