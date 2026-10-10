import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useToast } from '../lib/use-toast';
import { apiErrorMessage } from '../lib/use-api-list';
import { CONTRACT_STATUS_LABEL } from '../lib/contract-status';
import { ApiEnvelope, BranchContractStatus, BranchSummary, ContractStatusChangeResult } from '../lib/types';
import { Modal } from './Modal';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

const STATUSES: BranchContractStatus[] = ['ACTIVE', 'RENEWAL_DUE', 'EXPIRED', 'TERMINATED'];

// 인사정보관리 ADR-STF-07 — 본사가 지점 계약 상태를 바꾼다(PATCH /branches/:branchId/contract-status).
// TERMINATED로 바뀌면 서버가 같은 트랜잭션에서 그 지점의 진행 중 파견을 끝내고 담당 회원·강사 연결을 푼다.
// 결과(재배치 대상 직원·담당이 풀린 회원)는 본사가 바로 다음 행동을 해야 하는 목록이라, 모달을 닫지 않고 결과 화면으로 바꿔 보인다.
export function ContractStatusModal({ branch, onClose }: { branch: BranchSummary; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState<BranchContractStatus>(branch.contractStatus);
  const [result, setResult] = useState<ContractStatusChangeResult | null>(null);

  const terminating = status === 'TERMINATED' && branch.contractStatus !== 'TERMINATED';
  const unchanged = status === branch.contractStatus;

  const mutation = useMutation<ContractStatusChangeResult, AxiosError<ApiErrorBody>>({
    mutationFn: async () =>
      (
        await api.patch<ApiEnvelope<ContractStatusChangeResult>>(`/branches/${branch.id}/contract-status`, { status })
      ).data.data!,
    onSuccess: (changed) => {
      // 지점 목록(대시보드·발령 지점 선택)과, 종료 시 바뀌는 직원·회원·강사·변경 이력을 다시 읽게 한다.
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      toast.success(`${branch.name}의 계약 상태를 '${CONTRACT_STATUS_LABEL[changed.contractStatus]}'(으)로 바꿨습니다.`);
      if (changed.reassignmentTargets.length > 0 || changed.unassignedMembers.length > 0) setResult(changed);
      else onClose();
    },
  });

  if (result) {
    return (
      <Modal title="계약 종료 처리 결과" onClose={onClose}>
        <p style={{ marginTop: 0 }}>
          <strong>{branch.name}</strong>의 진행 중 파견 {result.reassignmentTargets.length}건을 오늘 날짜로 끝냈습니다.
        </p>
        {result.reassignmentTargets.length > 0 && (
          <>
            <h4 style={{ margin: '12px 0 4px', fontSize: 13 }}>재배치 대기 직원 ({result.reassignmentTargets.length}명)</h4>
            <p className="page-desc">직원 상세의 "파견 발령"으로 다른 지점에 보내 주세요. 계정과 재직 상태는 그대로입니다.</p>
            <table>
              <thead>
                <tr>
                  <th>직원코드</th>
                  <th>이름</th>
                </tr>
              </thead>
              <tbody>
                {result.reassignmentTargets.map((s) => (
                  <tr key={s.id}>
                    <td>{s.staffCode}</td>
                    <td>
                      <Link to={`/staff/${s.id}`} onClick={onClose} style={{ color: 'var(--color-primary)' }}>
                        {s.name}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {result.unassignedMembers.length > 0 && (
          <p className="page-desc" style={{ marginTop: 12 }}>
            담당이 풀린 회원 {result.unassignedMembers.length}명:{' '}
            {result.unassignedMembers
              .slice(0, 5)
              .map((m) => m.name)
              .join(', ')}
            {result.unassignedMembers.length > 5 ? ' 외' : ''}. 계약이 끝난 지점이라 새 담당은 정하지 않아도 됩니다.
          </p>
        )}
        <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary primary" onClick={onClose}>
            확인
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="계약 상태 변경" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!unchanged) mutation.mutate();
        }}
      >
        <p style={{ marginTop: 0 }}>
          <strong>{branch.name}</strong> · 지금 상태: {CONTRACT_STATUS_LABEL[branch.contractStatus]}
        </p>
        <div className="field">
          <label>새 계약 상태 *</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as BranchContractStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONTRACT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        {terminating ? (
          <ul className="page-desc" style={{ paddingLeft: 18 }}>
            <li>이 지점에 파견 중인 직원의 파견이 오늘 날짜로 모두 끝나고, 재배치 대기 목록으로 보입니다.</li>
            <li>그 직원들이 담당하던 회원의 담당과 강사 프로필 연결이 풀립니다.</li>
            <li>신규 회원 등록·예약·게시글·채용·파견 발령이 막힙니다. 과거 기록 조회는 그대로 됩니다.</li>
            <li>다시 다른 상태로 돌려도 끝난 파견은 되살아나지 않습니다(새로 발령해야 합니다).</li>
          </ul>
        ) : (
          <p className="page-desc">
            {branch.contractStatus === 'TERMINATED' && !unchanged
              ? '계약 종료를 되돌립니다. 신규 활동이 다시 열리지만, 끝난 파견은 되살아나지 않습니다.'
              : '갱신 임박·만료·정상은 신규 활동을 막지 않고, 파견도 그대로 둡니다.'}
          </p>
        )}
        {mutation.isError && <div className="forbidden-note">{apiErrorMessage(mutation.error)}</div>}
        <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button
            type="submit"
            className={terminating ? 'btn-danger-outline' : 'btn-secondary primary'}
            disabled={unchanged || mutation.isPending}
          >
            {terminating ? '계약 종료 처리' : '변경'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
