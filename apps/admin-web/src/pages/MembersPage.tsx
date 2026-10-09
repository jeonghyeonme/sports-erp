import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { apiErrorMessage, useApiPage } from '../lib/use-api-list';
import { Modal } from '../components/Modal';
import { Pager } from '../components/Pager';
import { BranchFilter } from '../components/BranchFilter';
import { ApiEnvelope, MemberRow } from '../lib/types';
import { useAuth } from '../lib/use-auth';
import { useToast } from '../lib/use-toast';

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<MemberRow['status'], string> = {
  ACTIVE: '활성',
  DORMANT: '휴면',
  WITHDRAWN: '탈퇴',
};

interface ApiErrorBody {
  code?: string;
  message?: string;
}

interface CreateMemberForm {
  name: string;
  phone: string;
  birthDate: string;
  gender: string;
  memo: string;
  guardianConsent: boolean;
}

const EMPTY_FORM: CreateMemberForm = {
  name: '',
  phone: '',
  birthDate: '',
  gender: '',
  memo: '',
  guardianConsent: false,
};

// 회원관리 A-6 — 만 19세 미만이면 등록 폼에 보호자 동의 체크박스를 조건부로 노출한다(상시 노출 아님).
function isMinor(birthDate: string): boolean {
  if (!birthDate) return false;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const beforeBirthdayThisYear =
    today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
  if (beforeBirthdayThisYear) age--;
  return age < 19;
}

function CreateMemberModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
const toast = useToast();
  const [form, setForm] = useState<CreateMemberForm>(EMPTY_FORM);
  const minor = isMinor(form.birthDate);

  const createMutation = useMutation<MemberRow, AxiosError<ApiErrorBody>, CreateMemberForm>({
    mutationFn: async (dto) => {
      const payload = {
        name: dto.name,
        phone: dto.phone || undefined,
        birthDate: dto.birthDate || undefined,
        gender: dto.gender || undefined,
        memo: dto.memo || undefined,
        guardianConsent: dto.guardianConsent || undefined,
      };
      return (await api.post<ApiEnvelope<MemberRow>>('/members', payload)).data.data!;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success(`${created.name} 회원을 등록했습니다.`);
      onClose();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    createMutation.mutate(form);
  }

  return (
    <Modal title="회원 등록" onClose={onClose}>
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
            <label>생년월일</label>
            <input
              type="date"
              value={form.birthDate}
              onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value, guardianConsent: false }))}
            />
          </div>
          <div className="field">
            <label>성별</label>
            <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
              <option value="">선택 안 함</option>
              <option value="M">남성</option>
              <option value="F">여성</option>
            </select>
          </div>
        </div>

        {minor && (
          <div className="forbidden-note" style={{ background: '#fef9c3', color: '#a16207', borderColor: '#fde68a', marginTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.guardianConsent}
                onChange={(e) => setForm((f) => ({ ...f, guardianConsent: e.target.checked }))}
              />
              만 19세 미만 회원입니다 — 법정대리인 동의를 확인했습니다
            </label>
          </div>
        )}

        <div className="field" style={{ marginTop: 12 }}>
          <label>메모</label>
          <textarea rows={2} value={form.memo} onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))} />
        </div>

        {createMutation.isError && (
          <div className="forbidden-note" style={{ marginTop: 12 }}>
            {apiErrorMessage(createMutation.error)}
          </div>
        )}

        <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn-secondary primary" disabled={createMutation.isPending || (minor && !form.guardianConsent)}>
            등록
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function MembersPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  // 필터가 바뀌면 1쪽부터 — effect 대신 렌더 중 이전 값 비교(BoardPage와 같은 패턴).
  const filterKey = `${branchId}|${status}|${q}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  // D43 — 서버가 쪽 단위로 자른다. 지점·상태·검색(q: 이름·회원번호·전화)은 모두 서버 조건이라 total과 쪽이 정확하다.
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (branchId) params.set('branchId', branchId);
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  const { data, isLoading, isFetching, isError, error } = useApiPage<MemberRow>(
    ['members', branchId, status, q, page],
    `/members?${params}`,
  );
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    setQ(searchInput.trim());
  };

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2>회원</h2>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            BRANCH_ADMIN은 본인 지점 회원만 봅니다. 목록은 {PAGE_SIZE}명씩 나눠 보여 주고, 지점·상태·검색은 서버에서
            거릅니다(D43).
          </p>
        </div>
        <button className="btn-secondary primary" style={{ flexShrink: 0 }} onClick={() => setShowCreate(true)}>
          + 회원 등록
        </button>
      </div>

      <form className="list-toolbar" onSubmit={submitSearch} style={{ gap: 8 }}>
        {isSuperAdmin && <BranchFilter value={branchId} onChange={setBranchId} />}
        <select className="role-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="상태">
          <option value="">전체 상태</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          className="search-input"
          placeholder="이름 · 회원번호 · 전화번호"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit" className="btn-secondary">
          검색
        </button>
      </form>

      {isError && <div className="forbidden-note">{apiErrorMessage(error)}</div>}
      {isLoading && <div className="loading-state">불러오는 중...</div>}
      {!isLoading && !isError && rows.length === 0 && (
        <div className="empty-state">{q || status || branchId ? '조건에 맞는 회원이 없습니다.' : '표시할 회원이 없습니다.'}</div>
      )}

      {!isError && rows.length > 0 && (
        <table>
          <thead>
            <tr>
              {isSuperAdmin && <th>지점</th>}
              <th>회원번호</th>
              <th>이름</th>
              <th>연락처</th>
              <th>담당 직원</th>
              <th>상태</th>
              <th>가입일</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="branch-row" onClick={() => navigate(`/members/${m.id}`)}>
                {isSuperAdmin && <td>{m.branchName ?? '-'}</td>}
                <td>{m.memberNo}</td>
                <td>{m.name}</td>
                <td>{m.phone ?? '-'}</td>
                <td>{m.assignedStaffName ?? '회원권만(미배정)'}</td>
                <td>
                  <span className={`badge ${m.status}`}>{STATUS_LABEL[m.status] ?? m.status}</span>
                </td>
                <td>{m.joinedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Pager page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} disabled={isFetching} />

      {showCreate && <CreateMemberModal onClose={() => setShowCreate(false)} />}
    </>
  );
}
