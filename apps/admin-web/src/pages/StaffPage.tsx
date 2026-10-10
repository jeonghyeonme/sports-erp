import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/use-auth';
import { useToast } from '../lib/use-toast';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { groupByBranch } from '../lib/group-by-branch';
import { DEMO_PASSWORD } from '../lib/demo-account';
import { CollapsibleBranchSection } from '../components/CollapsibleBranchSection';
import { Modal } from '../components/Modal';
import { ApiEnvelope, BranchSummary, StaffRow } from '../lib/types';

const AUTO_EXPAND_THRESHOLD = 3;
const EMPLOYMENT_TYPES = ['정규직', '계약직', '파트타임'];

interface ApiErrorBody {
  code?: string;
  message?: string;
}

function StaffTable({ rows, onOpen }: { rows: StaffRow[]; onOpen?: (id: string) => void }) {
  return (
    <table>
      <thead>
        <tr>
          <th>직원코드</th>
          <th>이름</th>
          <th>직급</th>
          <th>고용형태</th>
          <th>입사일</th>
          {rows.some((s) => s.resignDate) && <th>퇴사일</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.id} className={onOpen ? 'branch-row' : undefined} onClick={onOpen ? () => onOpen(s.id) : undefined}>
            <td>{s.staffCode}</td>
            <td>{s.name}</td>
            <td>{s.position ?? '-'}</td>
            <td>{s.employmentType ?? '-'}</td>
            <td>{s.hireDate}</td>
            {rows.some((r) => r.resignDate) && <td>{s.resignDate ?? '-'}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface HireForm {
  branchId: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  employmentType: string;
  hireDate: string;
  note: string;
}

const EMPTY_HIRE: HireForm = {
  branchId: '',
  name: '',
  email: '',
  phone: '',
  position: '',
  employmentType: '정규직',
  hireDate: '',
  note: '',
};

// 인사정보관리 불변규칙 1 — 채용(=최초 파견)은 본사만. 계약 종료 지점은 고를 수 없다(API도 409, log/090).
function HireStaffModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState<HireForm>(EMPTY_HIRE);
  const branchesQuery = useApiList<BranchSummary>(['branches'], '/branches');
  const branches = (branchesQuery.data ?? []).filter((b) => b.contractStatus !== 'TERMINATED');

  const hireMutation = useMutation<StaffRow, AxiosError<ApiErrorBody>, HireForm>({
    mutationFn: async (dto) => {
      const payload = {
        branchId: dto.branchId,
        name: dto.name.trim(),
        email: dto.email.trim(),
        phone: dto.phone || undefined,
        position: dto.position || undefined,
        employmentType: dto.employmentType || undefined,
        hireDate: dto.hireDate || undefined,
        note: dto.note || undefined,
      };
      return (await api.post<ApiEnvelope<StaffRow>>('/staff', payload)).data.data!;
    },
    onSuccess: (created, dto) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      // 사용자 결정(log/090) — 로그인 정보는 직접 전달해야 하는 정보라 닫을 때까지 남는 warning으로 보인다.
      toast.warning(
        `${created.name}님을 ${created.branchName ?? ''}에 채용했습니다(${created.staffCode}).\n` +
          `로그인: ${dto.email.trim()} / 임시 비밀번호 ${DEMO_PASSWORD}(데모 공통)`,
      );
      onClose();
      navigate(`/staff/${created.id}`);
    },
  });

  const set = (patch: Partial<HireForm>) => setForm((f) => ({ ...f, ...patch }));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.branchId || !form.name.trim() || !form.email.trim()) return;
    hireMutation.mutate(form);
  }

  return (
    <Modal title="직원 채용" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>파견 지점 *</label>
          <select value={form.branchId} onChange={(e) => set({ branchId: e.target.value })} required>
            <option value="">지점 선택</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>이름 *</label>
            <input value={form.name} onChange={(e) => set({ name: e.target.value })} required />
          </div>
          <div className="field">
            <label>이메일(로그인 ID) *</label>
            <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} required />
          </div>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>직급</label>
            <input value={form.position} placeholder="트레이너 등" onChange={(e) => set({ position: e.target.value })} />
          </div>
          <div className="field">
            <label>고용형태</label>
            <select value={form.employmentType} onChange={(e) => set({ employmentType: e.target.value })}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <div className="field">
            <label>연락처</label>
            <input value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
          </div>
          <div className="field">
            <label>입사일(비우면 오늘)</label>
            <input type="date" value={form.hireDate} onChange={(e) => set({ hireDate: e.target.value })} />
          </div>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>파견 메모</label>
          <input value={form.note} onChange={(e) => set({ note: e.target.value })} />
        </div>
        <p className="page-desc" style={{ marginTop: 12, marginBottom: 0 }}>
          채용하면 지점 직원(STAFF) 계정이 데모 공통 비밀번호로 만들어지고, 그 지점으로 첫 파견이 기록됩니다. 지점 관리자
          권한은 "권한 관리"에서 줍니다.
        </p>

        {hireMutation.isError && (
          <div className="forbidden-note" style={{ marginTop: 12 }}>
            {apiErrorMessage(hireMutation.error)}
          </div>
        )}

        <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn-secondary primary" disabled={hireMutation.isPending}>
            채용
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function StaffPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSelfServiceOnly = user?.role === 'STAFF';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [search, setSearch] = useState('');
  // 인사정보관리 A-5 — 목록은 기본으로 퇴사자를 뺀다. 퇴사 처리한 직원은 "퇴사" 탭에서 다시 찾는다.
  // ADR-STF-08 — 본사에게는 "재배치 대기"(활성 파견이 없는 재직 직원, 계약 종료 지점에서 생긴다) 탭이 더 있다.
  const [tab, setTab] = useState<'active' | 'unassigned' | 'resigned'>('active');
  const showResigned = tab === 'resigned';
  const [showHire, setShowHire] = useState(false);

  // 인사정보관리 A-7 — STAFF는 목록(/staff) 대신 본인 레코드(/staff/me)만 조회 가능하므로
  // 응답 모양(단일 객체 vs 배열)이 갈려 두 쿼리를 분리해서 처리한다.
  const listQuery = useQuery<StaffRow[], AxiosError<ApiErrorBody>>({
    queryKey: ['staff', 'list', tab],
    queryFn: async () =>
      (
        await api.get<ApiEnvelope<StaffRow[]>>(
          tab === 'resigned' ? '/staff?status=RESIGNED' : tab === 'unassigned' ? '/staff?unassigned=true' : '/staff',
        )
      ).data.data ?? [],
    enabled: !isSelfServiceOnly,
  });

  const meQuery = useQuery<StaffRow | undefined, AxiosError<ApiErrorBody>>({
    queryKey: ['staff', 'me'],
    queryFn: async () => (await api.get<ApiEnvelope<StaffRow>>('/staff/me')).data.data,
    enabled: isSelfServiceOnly,
  });

  const isLoading = isSelfServiceOnly ? meQuery.isLoading : listQuery.isLoading;
  const isError = isSelfServiceOnly ? meQuery.isError : listQuery.isError;
  const error = isSelfServiceOnly ? meQuery.error : listQuery.error;
  // 렌더마다 새 배열이 만들어지면 아래 groups의 useMemo가 매번 무효화되므로 rows도 메모한다.
  const rows = useMemo<StaffRow[]>(
    () => (isSelfServiceOnly ? (meQuery.data ? [meQuery.data] : []) : listQuery.data ?? []),
    [isSelfServiceOnly, meQuery.data, listQuery.data],
  );

  const groups = useMemo(() => {
    const all = groupByBranch(rows);
    const term = search.trim().toLowerCase();
    return term ? all.filter((g) => g.branchName.toLowerCase().includes(term)) : all;
  }, [rows, search]);

  const autoExpand = groups.length > 0 && groups.length <= AUTO_EXPAND_THRESHOLD;
  const openDetail = (id: string) => navigate(`/staff/${id}`);

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2>{isSelfServiceOnly ? '내 정보' : '직원'}</h2>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            {isSelfServiceOnly
              ? '인사정보관리 A-7 — STAFF는 본인 레코드만 조회할 수 있습니다(동료 직원 정보는 노출되지 않습니다).'
              : isSuperAdmin
                ? '본사가 채용해 지점에 파견한 인력입니다. 채용·파견 발령은 본사만 합니다. 행을 누르면 상세(파견 이력·발령)로 들어갑니다.'
                : '내 지점에 파견된 직원입니다. 행을 누르면 상세에서 정보 수정·퇴사 처리를 합니다. 채용·재배치는 본사에 요청하세요.'}
          </p>
        </div>
        {isSuperAdmin && (
          <button className="btn-secondary primary" style={{ flexShrink: 0 }} onClick={() => setShowHire(true)}>
            + 직원 채용
          </button>
        )}
      </div>

      {showHire && <HireStaffModal onClose={() => setShowHire(false)} />}

      {!isSelfServiceOnly && (
        <div className="list-toolbar" style={{ gap: 8 }}>
          <button className={tab === 'active' ? 'filter-chip active' : 'filter-chip'} onClick={() => setTab('active')}>
            재직
          </button>
          {isSuperAdmin && (
            <button
              className={tab === 'unassigned' ? 'filter-chip active' : 'filter-chip'}
              onClick={() => setTab('unassigned')}
            >
              재배치 대기
            </button>
          )}
          <button className={tab === 'resigned' ? 'filter-chip active' : 'filter-chip'} onClick={() => setTab('resigned')}>
            퇴사
          </button>
          <input
            className="search-input"
            placeholder="지점명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {tab === 'unassigned' && (
        <p className="page-desc">
          계약이 종료된 지점에서 파견이 끝난 직원입니다(ADR-STF-07). 행을 눌러 상세에서 "파견 발령"으로 다른 지점에
          보내거나, 더 일하지 않으면 "퇴사 처리"로 계정을 닫습니다.
        </p>
      )}
      {isError && <div className="forbidden-note">{apiErrorMessage(error ?? null)}</div>}
      {isLoading && <div className="loading-state">불러오는 중...</div>}

      {!isError && isSelfServiceOnly && rows.length > 0 && <StaffTable rows={rows} />}

      {!isError && !isSelfServiceOnly && !isLoading && rows.length === 0 && (
        <div className="empty-state">
          {showResigned
            ? '퇴사한 직원이 없습니다.'
            : tab === 'unassigned'
              ? '재배치를 기다리는 직원이 없습니다.'
              : '파견된 직원이 없습니다.'}
        </div>
      )}
      {!isError && !isSelfServiceOnly && !isLoading && rows.length > 0 && groups.length === 0 && (
        <div className="empty-state">검색 결과가 없습니다.</div>
      )}

      {!isError &&
        !isSelfServiceOnly &&
        groups.map((group) => (
          <CollapsibleBranchSection
            key={`${tab}-${group.branchId}`}
            branchName={group.branchName}
            count={group.rows.length}
            countLabel="명"
            defaultExpanded={autoExpand}
          >
            <StaffTable rows={group.rows} onOpen={openDetail} />
          </CollapsibleBranchSection>
        ))}
    </>
  );
}
