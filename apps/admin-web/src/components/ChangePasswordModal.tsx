import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/use-auth';
import { apiErrorMessage } from '../lib/use-api-list';
import { isDemoAccount } from '../lib/demo-account';
import { Modal } from './Modal';

const MIN_LENGTH = 8; // ChangePasswordDto @MinLength(8)

// 비밀번호 변경(PATCH /auth/password, 권한관리 A-5). 사용자 결정(log/091):
// 데모 계정은 서버가 403으로 막으므로 폼 대신 안내를 보이고, 바꾸면 서버가 모든 세션을 끊으므로 바로 로그아웃해 다시 로그인하게 한다.
export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const changeMutation = useMutation<unknown, AxiosError<unknown>>({
    mutationFn: async () => (await api.patch('/auth/password', { currentPassword: current, newPassword: next })).data,
    onSuccess: () => logout('비밀번호를 바꿨습니다. 새 비밀번호로 다시 로그인하세요.'),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (next.length < MIN_LENGTH) return setFormError(`새 비밀번호는 ${MIN_LENGTH}자 이상이어야 합니다.`);
    if (next !== confirm) return setFormError('새 비밀번호 확인이 일치하지 않습니다.');
    if (next === current) return setFormError('새 비밀번호가 지금 비밀번호와 같습니다.');
    setFormError(null);
    changeMutation.mutate();
  }

  if (isDemoAccount(user?.email)) {
    return (
      <Modal title="비밀번호 변경" onClose={onClose}>
        <p style={{ marginTop: 0 }}>
          데모 계정은 비밀번호를 바꿀 수 없습니다. 방문자 누구나 로그인 화면의 "데모 계정으로 바로 체험하기"를 쓸 수 있게
          공통 비밀번호를 그대로 둡니다.
        </p>
        <p className="page-desc">본사가 채용한 직원 계정과 회원이 직접 만든 계정은 여기서 바꿀 수 있습니다.</p>
        <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            닫기
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="비밀번호 변경" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label>현재 비밀번호 *</label>
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>새 비밀번호 * ({MIN_LENGTH}자 이상)</label>
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>새 비밀번호 확인 *</label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        <p className="page-desc" style={{ marginTop: 12, marginBottom: 0 }}>
          바꾸면 다른 기기의 로그인도 모두 끝나고, 지금 화면도 로그인 화면으로 돌아갑니다.
        </p>
        {(formError || changeMutation.isError) && (
          <div className="forbidden-note" style={{ marginTop: 12 }}>
            {formError ?? apiErrorMessage(changeMutation.error)}
          </div>
        )}
        <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn-secondary primary" disabled={changeMutation.isPending}>
            변경
          </button>
        </div>
      </form>
    </Modal>
  );
}
