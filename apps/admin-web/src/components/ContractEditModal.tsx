import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useToast } from '../lib/use-toast';
import { apiErrorMessage } from '../lib/use-api-list';
import { ApiEnvelope, BranchSummary } from '../lib/types';
import { Modal } from './Modal';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

export type ContractEditMode = 'renew' | 'correct';

// D68 — 본사가 위탁계약을 갱신(새 종료일 + 필요하면 상대방, 상태는 정상으로)하거나 오타를 정정한다.
// 두 경우 모두 서버가 같은 트랜잭션에서 계약 이력(변경 이력 entity 'Branch')을 남긴다.
export function ContractEditModal({
  branch,
  mode,
  onClose,
}: {
  branch: BranchSummary;
  mode: ContractEditMode;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [partner, setPartner] = useState(branch.contractPartner ?? '');
  const [startAt, setStartAt] = useState(branch.contractStartAt ?? '');
  const [endAt, setEndAt] = useState(mode === 'renew' ? '' : (branch.contractEndAt ?? ''));
  const renewing = mode === 'renew';

  const mutation = useMutation<BranchSummary, AxiosError<ApiErrorBody>>({
    mutationFn: async () => {
      // 바뀐 칸만 보낸다 — 서버도 바뀐 필드만 이력에 남긴다.
      const changedPartner = partner.trim() !== (branch.contractPartner ?? '') ? { contractPartner: partner.trim() } : {};
      const res = renewing
        ? await api.post<ApiEnvelope<BranchSummary>>(`/branches/${branch.id}/contract/renewals`, {
            contractEndAt: endAt,
            ...changedPartner,
          })
        : await api.patch<ApiEnvelope<BranchSummary>>(`/branches/${branch.id}/contract`, {
            ...changedPartner,
            ...(startAt !== branch.contractStartAt ? { contractStartAt: startAt } : {}),
            ...(endAt && endAt !== branch.contractEndAt ? { contractEndAt: endAt } : {}),
          });
      return res.data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      toast.success(renewing ? `${branch.name}의 계약을 ${endAt}까지 갱신했습니다.` : `${branch.name}의 계약 정보를 고쳤습니다.`);
      onClose();
    },
  });

  return (
    <Modal title={renewing ? '계약 갱신' : '계약 정보 수정'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <p style={{ marginTop: 0 }}>
          <strong>{branch.name}</strong> · 지금 계약 {branch.contractStartAt ?? '-'} ~ {branch.contractEndAt ?? '상시'}
        </p>
        <div className="field">
          <label>계약 상대방 *</label>
          <input value={partner} onChange={(e) => setPartner(e.target.value)} maxLength={100} required />
        </div>
        {!renewing && (
          <div className="field">
            <label>계약 시작일 *</label>
            <input type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
          </div>
        )}
        <div className="field">
          <label>{renewing ? '새 종료일 *' : '계약 종료일'}</label>
          <input
            type="date"
            value={endAt}
            min={renewing ? branch.contractEndAt : startAt}
            onChange={(e) => setEndAt(e.target.value)}
            required={renewing}
          />
        </div>
        <p className="page-desc">
          {renewing
            ? '새 종료일은 지금 종료일보다 뒤여야 합니다. 갱신하면 계약 상태가 "계약 정상"으로 돌아갑니다.'
            : '입력 실수를 고칠 때 씁니다. 갱신으로 세지 않고 계약 상태도 바꾸지 않습니다. 계약을 연장했다면 "계약 갱신"을 쓰세요.'}
        </p>
        {mutation.isError && <div className="forbidden-note">{apiErrorMessage(mutation.error)}</div>}
        <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn-secondary primary" disabled={mutation.isPending}>
            {renewing ? '갱신' : '저장'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
