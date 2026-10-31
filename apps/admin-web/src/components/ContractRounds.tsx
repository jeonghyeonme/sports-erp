import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useToast } from '../lib/use-toast';
import { apiErrorMessage } from '../lib/use-api-list';
import { CONTRACT_FILE_ACCEPT, CONTRACT_FILE_MAX_BYTES, openContractFile, uploadContractFile } from '../lib/contract-files';
import { CONTRACT_FILE_KIND_LABEL } from '../lib/contract-status';
import { ApiEnvelope, BranchSummary, ContractFileKind, ContractFileRow, ContractRoundRow } from '../lib/types';
import { Modal } from './Modal';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

// D69 결정 2·4·6 — 계약 회차 목록(최근 회차부터). 계약서는 이 화면에서만 연다(열 때마다 열람 기록, 결정 8).
// 지난 회차와 교체된 파일은 읽기 전용이다. 올리기·교체는 본사만, 진행 중 회차에만.
export function ContractRounds({ branch, canEdit }: { branch: BranchSummary; canEdit: boolean }) {
  const toast = useToast();
  const [uploadKind, setUploadKind] = useState<ContractFileKind | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const query = useQuery<ContractRoundRow[], AxiosError<ApiErrorBody>>({
    queryKey: ['contract-rounds', branch.id],
    queryFn: async () => (await api.get<ApiEnvelope<ContractRoundRow[]>>(`/branches/${branch.id}/contract/rounds`)).data.data ?? [],
  });
  const terminated = branch.contractStatus === 'TERMINATED';

  async function open(f: ContractFileRow) {
    setOpening(f.id);
    try {
      await openContractFile(branch.id, f.id, f.fileName);
    } catch (err) {
      toast.error(apiErrorMessage(err as AxiosError) ?? '파일을 열지 못했습니다.');
    } finally {
      setOpening(null);
    }
  }

  if (query.isLoading) return <div className="loading-state">불러오는 중...</div>;
  if (query.isError) return <div className="forbidden-note">{apiErrorMessage(query.error)}</div>;
  const rounds = query.data ?? [];

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>회차</th>
            <th>상대방</th>
            <th>기간</th>
            <th>파일</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((r) => (
            <tr key={r.id}>
              <td>
                {r.roundNo}회차
                {r.current && <span className="badge ACTIVE" style={{ marginLeft: 6 }}>진행 중</span>}
              </td>
              <td>{r.contractPartner}</td>
              <td>
                {r.contractStartAt} ~ {r.contractEndAt}
                {r.terminatedAt && <div className="page-desc" style={{ margin: 0 }}>해지 확정 {r.terminatedAt}</div>}
              </td>
              <td>
                {r.files.length === 0 && <span className="badge PAUSED">계약서 미등록</span>}
                {r.files.map((f) => (
                  <div key={f.id} style={{ opacity: f.replacedAt ? 0.6 : 1 }}>
                    {CONTRACT_FILE_KIND_LABEL[f.kind]} ·{' '}
                    <button type="button" className="link-button" disabled={opening !== null} onClick={() => open(f)}>
                      {f.fileName}
                    </button>
                    {f.replacedAt && ' (교체됨)'}
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {canEdit && !terminated && (
        <div className="action-row" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={() => setUploadKind('CONTRACT')}>
            {branch.hasContractFile ? '계약서 교체' : '계약서 올리기'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setUploadKind('TERMINATION_AGREEMENT')}>
            {branch.hasTerminationAgreement ? '해지 합의서 교체' : '해지 합의서 올리기'}
          </button>
        </div>
      )}
      {uploadKind && <ContractFileModal branch={branch} kind={uploadKind} onClose={() => setUploadKind(null)} />}
    </>
  );
}

// 진행 중 회차에 계약서·해지 합의서를 올린다(이미 있으면 교체 — 옛 파일은 "교체됨"으로 남는다).
function ContractFileModal({ branch, kind, onClose }: { branch: BranchSummary; kind: ContractFileKind; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const label = CONTRACT_FILE_KIND_LABEL[kind];

  const mutation = useMutation<BranchSummary, AxiosError<ApiErrorBody> | Error>({
    mutationFn: async () => {
      if (!file) throw new Error('파일을 고르세요.');
      if (file.size > CONTRACT_FILE_MAX_BYTES) throw new Error('파일 하나는 10MB까지 올릴 수 있습니다.');
      const ref = await uploadContractFile(file);
      return (await api.post<ApiEnvelope<BranchSummary>>(`/branches/${branch.id}/contract/files`, { kind, ...ref })).data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['contract-rounds', branch.id] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      toast.success(`${branch.name} ${branch.contractRoundNo}회차에 ${label}를 올렸습니다.`);
      onClose();
    },
  });
  const error = mutation.error;

  return (
    <Modal title={`${label} 올리기`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <p style={{ marginTop: 0 }}>
          <strong>{branch.name}</strong> · {branch.contractRoundNo}회차(진행 중)
        </p>
        <div className="field">
          <label>{label} *</label>
          <input type="file" accept={CONTRACT_FILE_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
        </div>
        <p className="page-desc">
          {kind === 'TERMINATION_AGREEMENT'
            ? '해지 합의서를 올린 뒤 "계약 상태 변경"에서 계약 종료를 확정합니다. 확정하면 이 지점에는 더 올릴 수 없습니다.'
            : '이미 계약서가 있으면 교체됩니다. 옛 파일은 지워지지 않고 "교체됨"으로 남습니다. 계약 기간이 바뀌었다면 "계약 갱신"을 쓰세요.'}
        </p>
        {error && (
          <div className="forbidden-note">{error instanceof AxiosError ? apiErrorMessage(error) : error.message}</div>
        )}
        <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn-secondary primary" disabled={mutation.isPending}>
            올리기
          </button>
        </div>
      </form>
    </Modal>
  );
}
