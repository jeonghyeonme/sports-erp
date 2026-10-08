import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { ApiEnvelope, AuditLogRow, BranchSummary } from '../lib/types';
import { useAuth } from '../lib/use-auth';

const PAGE_SIZE = 20;

// D44 — 지금 기록하는 이벤트 3종. 늘릴 때는 api `prisma/audit.ts`의 AuditAction과 함께 고친다.
const ACTION_LABEL: Record<string, string> = {
  ROLE_CHANGED: '권한 변경',
  RESIGNED: '퇴사 처리',
  ASSIGNED: '파견(재배치)',
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: '본사 관리자',
  BRANCH_ADMIN: '지점 관리자',
  STAFF: '지점 직원',
};

interface ApiErrorBody {
  code?: string;
  message?: string;
}

function formatTime(iso: string): string {
  // 표시만 KST로 — 기록 시각 자체는 UTC로 저장된다.
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });
}

// 변경 이력 — 본사(SUPER_ADMIN) 전용 감사 기록(D44). 인사 변경(권한·퇴사·파견)을 누가 언제 했는지 최신순으로 본다.
export function AuditLogsPage() {
  const { user } = useAuth();
  // 메뉴는 SUPER_ADMIN에게만 있지만 주소로 바로 들어올 수 있다. 서버가 403을 주지만, 재시도하며 "불러오는 중"에 머물지 않게
  // 다른 역할이면 부르지 않고 바로 안내한다(권한 판정 자체는 서버가 한다).
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  // 필터가 바뀌면 페이지를 1로 — effect 대신 렌더 중 이전 값 비교(BoardPage와 같은 패턴).
  const [prevAction, setPrevAction] = useState(action);
  if (action !== prevAction) {
    setPrevAction(action);
    setPage(1);
  }

  const { data, isLoading, isError, error } = useQuery<{ rows: AuditLogRow[]; total: number }, AxiosError<ApiErrorBody>>({
    queryKey: ['audit-logs', action, page],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const actionParam = action ? `&action=${action}` : '';
      const res = await api.get<ApiEnvelope<AuditLogRow[]>>(`/audit-logs?page=${page}&limit=${PAGE_SIZE}${actionParam}`);
      return { rows: res.data.data ?? [], total: res.data.meta?.total ?? 0 };
    },
  });
  // 파견 전후 지점을 이름으로 보이기 위해 지점 목록을 쓴다(다른 화면과 같은 쿼리 키라 캐시를 공유한다).
  const branches = useApiList<BranchSummary>(['branches'], '/branches');
  const branchName = (id: unknown) => branches.data?.find((b) => b.id === id)?.name ?? String(id ?? '-');

  const describe = (r: AuditLogRow): string => {
    const before = r.before ?? {};
    const after = r.after ?? {};
    if (r.action === 'ROLE_CHANGED') {
      return `${ROLE_LABEL[String(before.role)] ?? before.role} → ${ROLE_LABEL[String(after.role)] ?? after.role}`;
    }
    if (r.action === 'RESIGNED') {
      return `${branchName(before.branchId)} · 퇴사일 ${after.resignDate ?? '-'}`;
    }
    if (r.action === 'ASSIGNED') {
      const released = Number(after.releasedMemberCount ?? 0);
      const note = after.note ? ` · ${after.note}` : '';
      return `${branchName(before.branchId)} → ${branchName(after.branchId)}${released ? ` · 담당 회원 ${released}명 해제` : ''}${note}`;
    }
    return '-';
  };

  if (!isSuperAdmin) {
    return (
      <>
        <div className="page-header">
          <h2>변경 이력</h2>
        </div>
        <div className="forbidden-note">변경 이력은 본사 관리자만 볼 수 있습니다.</div>
      </>
    );
  }

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="page-header">
        <h2>변경 이력</h2>
        <p className="page-desc">
          D44 — 직원 권한 변경·퇴사 처리·파견을 누가 언제 했는지 남긴 기록입니다. 본사 관리자만 볼 수 있고, 변경과 같은
          트랜잭션에서 기록되어 실패한 요청은 남지 않습니다.
        </p>
      </div>

      <div className="list-toolbar">
        <select className="role-select" value={action} onChange={(e) => setAction(e.target.value)} aria-label="이벤트 종류">
          <option value="">전체 이벤트</option>
          {Object.entries(ACTION_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {isError && <div className="forbidden-note">{apiErrorMessage(error)}</div>}
      {isLoading && <div className="loading-state">불러오는 중...</div>}
      {!isLoading && !isError && rows.length === 0 && <div className="empty-state">기록된 변경 이력이 없습니다.</div>}

      {!isError && rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>시각</th>
              <th>이벤트</th>
              <th>대상 직원</th>
              <th>내용</th>
              <th>처리자</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatTime(r.createdAt)}</td>
                <td>{ACTION_LABEL[r.action] ?? r.action}</td>
                <td>{r.entityName ?? r.entityId}</td>
                <td>{describe(r)}</td>
                <td>{r.actorName ?? '(삭제된 계정)'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!isLoading && !isError && total > 0 && (
        <div className="action-row" style={{ justifyContent: 'center', gap: 12, marginTop: 8 }}>
          <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            이전
          </button>
          <span style={{ fontSize: 13, color: '#6b7280' }}>
            {page} / {totalPages}페이지 (전체 {total}건)
          </span>
          <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            다음
          </button>
        </div>
      )}
    </>
  );
}
