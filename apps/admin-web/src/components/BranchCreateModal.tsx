import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const EMPTY = {
  name: '',
  code: '',
  region: '',
  address: '',
  phone: '',
  standardCheckInTime: '09:00',
  contractPartner: '',
  contractStartAt: '',
  contractEndAt: '',
};

// D68 결정 5 — 새 위탁계약 = 새 지점(본사 전용). 등록하면 상세로 옮겨 시설·프로그램·파견을 이어서 한다.
// D69 — 계약은 1회차로 만들어지고, 계약서와 종료일이 필수다.
export function BranchCreateModal({ regions, onClose }: { regions: string[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const mutation = useMutation<BranchSummary, AxiosError<ApiErrorBody> | Error>({
    mutationFn: async () => {
      if (!file) throw new Error('계약서를 올려야 지점을 등록할 수 있습니다.');
      if (file.size > CONTRACT_FILE_MAX_BYTES) throw new Error('파일 하나는 10MB까지 올릴 수 있습니다.');
      // 비운 선택 칸은 보내지 않는다(서버가 형식을 검사한다).
      const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, v.trim()]));
      const contractFile = await uploadContractFile(file);
      return (await api.post<ApiEnvelope<BranchSummary>>('/branches', { ...body, contractFile })).data.data!;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      toast.success(`${created.name}을(를) 등록했습니다. 시설·프로그램·직원 파견을 이어서 준비하세요.`);
      onClose();
      navigate(`/branches/${created.id}`);
    },
  });

  return (
    <Modal title="지점 등록" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="field">
          <label>지점명 *</label>
          <input value={form.name} onChange={set('name')} maxLength={50} placeholder="예: 판교점" required />
        </div>
        <div className="field">
          <label>지점 코드 *</label>
          <input
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            pattern="[A-Z]{2,12}"
            title="영문 대문자 2~12자"
            placeholder="예: PANGYO"
            required
          />
        </div>
        <p className="page-desc">지점 코드는 회원번호·직원코드 앞부분이 되고 나중에 바꿀 수 없습니다(영문 대문자 2~12자).</p>
        <div className="field">
          <label>지역 *</label>
          <input value={form.region} onChange={set('region')} list="branch-regions" maxLength={20} placeholder="예: 경기" required />
          <datalist id="branch-regions">
            {regions.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label>주소</label>
          <input value={form.address} onChange={set('address')} maxLength={200} />
        </div>
        <div className="field">
          <label>대표 전화</label>
          <input value={form.phone} onChange={set('phone')} placeholder="031-000-0000" />
        </div>
        <div className="field">
          <label>출근 기준 시각</label>
          <input type="time" value={form.standardCheckInTime} onChange={set('standardCheckInTime')} />
        </div>
        <div className="field">
          <label>계약서 *</label>
          <input type="file" accept={CONTRACT_FILE_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
        </div>
        <div className="field">
          <label>계약 상대방 *</label>
          <input value={form.contractPartner} onChange={set('contractPartner')} maxLength={100} placeholder="예: 판교 OO오피스텔 관리단" required />
        </div>
        <div className="field">
          <label>계약 시작일 *</label>
          <input type="date" value={form.contractStartAt} onChange={set('contractStartAt')} required />
        </div>
        <div className="field">
          <label>계약 종료일 *</label>
          <input type="date" value={form.contractEndAt} min={form.contractStartAt} onChange={set('contractEndAt')} required />
        </div>
        <p className="page-desc">계약서를 보고 상대방·기간을 넣으세요. 1회차로 등록되고 계약 상태는 "계약 정상"으로 시작합니다.</p>
        {mutation.error && (
          <div className="forbidden-note">
            {mutation.error instanceof AxiosError ? apiErrorMessage(mutation.error) : mutation.error.message}
          </div>
        )}
        <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn-secondary primary" disabled={mutation.isPending}>
            등록
          </button>
        </div>
      </form>
    </Modal>
  );
}
