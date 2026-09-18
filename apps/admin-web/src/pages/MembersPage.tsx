import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { groupByBranch } from '../lib/group-by-branch';
import { CollapsibleBranchSection } from '../components/CollapsibleBranchSection';
import { Modal } from '../components/Modal';
import { ApiEnvelope, MemberRow } from '../lib/types';

// 검색으로 이만큼 좁혀지면 굳이 또 눌러서 펼치게 하지 않고 바로 보여준다.
const AUTO_EXPAND_THRESHOLD = 3;

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

// 05문서 §6 — 만 19세 미만이면 등록 폼에 보호자 동의 체크박스를 조건부로 노출한다(상시 노출 아님).
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
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
  const { data, isLoading, isError, error } = useApiList<MemberRow>(['members'], '/members');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const groups = useMemo(() => {
    const all = groupByBranch(data ?? []);
    const term = search.trim().toLowerCase();
    return term ? all.filter((g) => g.branchName.toLowerCase().includes(term)) : all;
  }, [data, search]);

  const autoExpand = groups.length > 0 && groups.length <= AUTO_EXPAND_THRESHOLD;

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2>회원</h2>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            05문서 기준 더미 데이터입니다. BRANCH_ADMIN은 본인 지점 회원만, STAFF는 접근 시 403이 표시됩니다.
            지점별로 묶어서 보여줍니다(98개 지점 규모 대응 — 지점명으로 검색해 좁혀보세요).
          </p>
        </div>
        <button className="btn-secondary primary" style={{ flexShrink: 0 }} onClick={() => setShowCreate(true)}>
          + 회원 등록
        </button>
      </div>

      {isError && <div className="forbidden-note">{apiErrorMessage(error)}</div>}
      {isLoading && <div className="loading-state">불러오는 중...</div>}

      {!isLoading && !isError && (data?.length ?? 0) > 0 && (
        <div className="list-toolbar">
          <input
            className="search-input"
            placeholder="지점명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {!isLoading && !isError && (data?.length ?? 0) === 0 && (
        <div className="empty-state">표시할 회원이 없습니다.</div>
      )}
      {!isLoading && !isError && (data?.length ?? 0) > 0 && groups.length === 0 && (
        <div className="empty-state">검색 결과가 없습니다.</div>
      )}

      {!isError &&
        groups.map((group) => (
          <CollapsibleBranchSection
            key={group.branchId}
            branchName={group.branchName}
            count={group.rows.length}
            countLabel="명"
            defaultExpanded={autoExpand}
          >
            <table>
              <thead>
                <tr>
                  <th>회원번호</th>
                  <th>이름</th>
                  <th>연락처</th>
                  <th>담당 직원</th>
                  <th>상태</th>
                  <th>가입일</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((m) => (
                  <tr key={m.id} className="branch-row" onClick={() => navigate(`/members/${m.id}`)}>
                    <td>{m.memberNo}</td>
                    <td>{m.name}</td>
                    <td>{m.phone ?? '-'}</td>
                    <td>{m.assignedStaffName ?? '회원권만(미배정)'}</td>
                    <td>
                      <span className={`badge ${m.status}`}>{m.status}</span>
                    </td>
                    <td>{m.joinedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CollapsibleBranchSection>
        ))}

      {showCreate && <CreateMemberModal onClose={() => setShowCreate(false)} />}
    </>
  );
}
