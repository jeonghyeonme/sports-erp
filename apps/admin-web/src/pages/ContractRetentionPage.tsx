import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { apiErrorMessage } from '../lib/use-api-list';
import { useAuth } from '../lib/use-auth';
import { useToast } from '../lib/use-toast';
import { CONTRACT_FILE_KIND_LABEL } from '../lib/contract-status';
import { ApiEnvelope, ContractRetentionOverview, ContractRetentionRow } from '../lib/types';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

// D71 — 계약 파일 보존 현황(본사 전용). 보존 끝 = 회차가 끝난 날 + 3년. 그 6개월 전부터 실물 이관을 알리고,
// 이관을 표시한 파일은 보존 끝이 지나면 여기서 시스템 파일을 정리한다(이관 전에는 지우지 않는다).
export function ContractRetentionPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const queryClient = useQueryClient();
  const toast = useToast();
  const query = useQuery<ContractRetentionOverview, AxiosError<ApiErrorBody>>({
    queryKey: ['contract-retention'],
    enabled: isSuperAdmin,
    queryFn: async () => (await api.get<ApiEnvelope<ContractRetentionOverview>>('/branches/contract-files/retention')).data.data!,
  });

  const purge = useMutation<{ purged: number }, AxiosError<ApiErrorBody>, string[]>({
    mutationFn: async (fileIds) =>
      (await api.post<ApiEnvelope<{ purged: number }>>('/branches/contract-files/purge', { fileIds })).data.data!,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['contract-retention'] });
      queryClient.invalidateQueries({ queryKey: ['contract-rounds'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      toast.success(`계약 파일 ${res.purged}개의 시스템 파일을 정리했습니다.`);
    },
    onError: (err) => toast.error(apiErrorMessage(err) ?? '정리하지 못했습니다.'),
  });

  if (!isSuperAdmin) {
    return (
      <>
        <div className="page-header">
          <h2>계약 파일 보존</h2>
        </div>
        <div className="forbidden-note">계약 파일 보존 현황은 본사 관리자만 볼 수 있습니다.</div>
      </>
    );
  }

  const archiveNeeded = query.data?.archiveNeeded ?? [];
  const purgeCandidates = query.data?.purgeCandidates ?? [];

  return (
    <>
      <div className="page-header">
        <h2>계약 파일 보존</h2>
        <p className="page-desc">
          계약서·해지 합의서는 회차가 끝난 날(해지로 끝나면 해지 확정일)부터 3년 동안 시스템에 두고, 그 뒤 7년은 실물로 보관합니다.
          보존 끝 6개월 전부터 실물 이관이 필요한 파일로 보입니다. 이관은 지점 상세의 계약 회차에서 파일마다 표시하고, 표시한 뒤에도 보존
          끝까지는 열람할 수 있습니다. 시스템 파일은 이관을 표시했고 보존 끝이 지난 파일만 아래에서 정리합니다.
        </p>
      </div>

      {query.isLoading && <div className="loading-state">불러오는 중...</div>}
      {query.isError && <div className="forbidden-note">{apiErrorMessage(query.error)}</div>}

      {query.data && (
        <>
          <section className="detail-section">
            <h3>실물 이관이 필요한 파일 ({archiveNeeded.length})</h3>
            {archiveNeeded.length === 0 ? (
              <p className="page-desc">보존 끝 6개월 안에 들어온 미이관 파일이 없습니다.</p>
            ) : (
              <RetentionTable rows={archiveNeeded} />
            )}
          </section>

          <section className="detail-section">
            <h3>보존 끝나 정리할 파일 ({purgeCandidates.length})</h3>
            {purgeCandidates.length === 0 ? (
              <p className="page-desc">정리할 파일이 없습니다.</p>
            ) : (
              <>
                <RetentionTable rows={purgeCandidates} />
                <div className="action-row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-secondary primary"
                    disabled={purge.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `위 ${purgeCandidates.length}개 파일을 시스템에서 지웁니다. 되돌릴 수 없고, 이후에는 실물 보관본만 남습니다. 정리할까요?`,
                        )
                      ) {
                        purge.mutate(purgeCandidates.map((r) => r.id));
                      }
                    }}
                  >
                    보존 끝난 파일 정리
                  </button>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </>
  );
}

function RetentionTable({ rows }: { rows: ContractRetentionRow[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>지점</th>
          <th>회차</th>
          <th>파일</th>
          <th>보존 끝</th>
          <th>실물 이관</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <Link to={`/branches/${r.branchId}`}>{r.branchName}</Link>
            </td>
            <td>{r.roundNo}회차</td>
            <td>
              {CONTRACT_FILE_KIND_LABEL[r.kind]} · {r.fileName}
              {r.replacedAt && ' (교체됨)'}
            </td>
            <td>
              {r.retentionUntil}
              {r.retentionEnded && <span className="badge PAUSED" style={{ marginLeft: 6 }}>지남</span>}
            </td>
            <td>{r.archivedAt ? `${r.archivedAt.slice(0, 10)} · ${r.archivedByName ?? '-'}` : '미이관'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
