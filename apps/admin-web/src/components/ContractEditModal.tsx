import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useToast } from '../lib/use-toast';
import { apiErrorMessage } from '../lib/use-api-list';
import { CONTRACT_FILE_ACCEPT, CONTRACT_FILE_MAX_BYTES, uploadContractFile } from '../lib/contract-files';
import { ApiEnvelope, BranchSummary } from '../lib/types';
import { Modal } from './Modal';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

export type ContractEditMode = 'renew' | 'correct';

// D69 — 갱신은 새 회차: 새 계약서를 올리고 그 계약서를 보며 상대방·기간을 넣는다(상태는 정상으로).
// 정정은 진행 중인 회차의 오타만 고친다(D68 결정 2). 두 경우 모두 서버가 같은 트랜잭션에서 계약 이력을 남긴다.
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
  const renewing = mode === 'renew';
  const [partner, setPartner] = useState(branch.contractPartner);
  const [startAt, setStartAt] = useState(renewing ? '' : branch.contractStartAt);
  const [endAt, setEndAt] = useState(renewing ? '' : branch.contractEndAt);
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation<BranchSummary, AxiosError<ApiErrorBody> | Error>({
    mutationFn: async () => {
      if (renewing) {
        if (!file) throw new Error('새 계약서를 올려야 갱신할 수 있습니다.');
        if (file.size > CONTRACT_FILE_MAX_BYTES) throw new Error('파일 하나는 10MB까지 올릴 수 있습니다.');
        const contractFile = await uploadContractFile(file);
        const res = await api.post<ApiEnvelope<BranchSummary>>(`/branches/${branch.id}/contract/renewals`, {
          contractPartner: partner.trim(),
          contractStartAt: startAt,
          contractEndAt: endAt,
          contractFile,
        });
        return res.data.data!;
      }
      // 바뀐 칸만 보낸다 — 서버도 바뀐 필드만 이력에 남긴다.
      const res = await api.patch<ApiEnvelope<BranchSummary>>(`/branches/${branch.id}/contract`, {
        ...(partner.trim() !== branch.contractPartner ? { contractPartner: partner.trim() } : {}),
        ...(startAt !== branch.contractStartAt ? { contractStartAt: startAt } : {}),
        ...(endAt !== branch.contractEndAt ? { contractEndAt: endAt } : {}),
      });
      return res.data.data!;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['contract-rounds', branch.id] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      toast.success(
        renewing
          ? `${branch.name}의 계약을 ${saved.contractRoundNo}회차(${saved.contractStartAt} ~ ${saved.contractEndAt})로 갱신했습니다.`
          : `${branch.name}의 ${saved.contractRoundNo}회차 계약 정보를 고쳤습니다.`,
      );
      onClose();
    },
  });
  const error = mutation.error;

  return (
    <Modal title={renewing ? '계약 갱신(새 회차)' : '계약 정보 수정'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <p style={{ marginTop: 0 }}>
          <strong>{branch.name}</strong> · 지금 {branch.contractRoundNo}회차 {branch.contractStartAt} ~ {branch.contractEndAt}
        </p>
        {renewing && (
          <div className="field">
            <label>새 계약서 *</label>
            <input type="file" accept={CONTRACT_FILE_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
          </div>
        )}
        <div className="field">
          <label>계약 상대방 *</label>
          <input value={partner} onChange={(e) => setPartner(e.target.value)} maxLength={100} required />
        </div>
        <div className="field">
          <label>{renewing ? '새 회차 시작일 *' : '계약 시작일 *'}</label>
          <input type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
        </div>
        <div className="field">
          <label>{renewing ? '새 회차 종료일 *' : '계약 종료일 *'}</label>
          <input type="date" value={endAt} min={startAt} onChange={(e) => setEndAt(e.target.value)} required />
        </div>
        <p className="page-desc">
          {renewing
            ? `계약서를 보고 상대방·기간을 넣으세요. ${branch.contractRoundNo + 1}회차가 생기고 계약 상태가 "계약 정상"으로 돌아갑니다. 새 시작일은 지금 회차 시작일보다 뒤여야 합니다.`
            : `${branch.contractRoundNo}회차의 입력 실수를 고칠 때 씁니다. 지난 회차는 고칠 수 없고, 갱신으로 세지 않으며 상태도 바꾸지 않습니다.`}
        </p>
        {error && (
          <div className="forbidden-note">{error instanceof AxiosError ? apiErrorMessage(error) : error.message}</div>
        )}
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
