import { FormEvent, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/use-auth';
import { describeError } from '../lib/errors';
import { DEMO_MEMBER_EMAILS } from '../lib/demo-account';

const MIN_LENGTH = 8; // ChangePasswordDto @MinLength(8)

// 내 정보 > 비밀번호 변경(PATCH /auth/password, 권한관리 A-5). 사용자 결정(log/091):
// 바꾸면 서버가 모든 refresh token을 폐기하므로 바로 로그인 화면으로 보내고 안내를 남긴다. 데모 계정은 안내만 보인다.
// 펼칠 때만 폼을 그리고, 요청은 "변경" 1회뿐이다(design-constants ⑩).
export function ChangePasswordSection() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isDemo = !!user && DEMO_MEMBER_EMAILS.has(user.email);

  const close = () => {
    setOpen(false);
    setCurrent('');
    setNext('');
    setConfirm('');
    setFormError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < MIN_LENGTH) return setFormError(`새 비밀번호는 ${MIN_LENGTH}자 이상이어야 합니다.`);
    if (next !== confirm) return setFormError('새 비밀번호 확인이 일치하지 않습니다.');
    if (next === current) return setFormError('새 비밀번호가 지금 비밀번호와 같습니다.');
    setSaving(true);
    setFormError(null);
    try {
      await api.patch('/auth/password', { currentPassword: current, newPassword: next });
      await logout({ notice: '비밀번호를 바꿨습니다. 새 비밀번호로 다시 로그인해 주세요.', serverRevoked: true });
    } catch (err) {
      setFormError(describeError(err, '비밀번호를 바꾸지 못했습니다. 잠시 후 다시 시도하세요.'));
      setSaving(false);
    }
  };

  return (
    <section className="panel stack-sm">
      <div className="card-head">
        <h2 className="card-title">비밀번호</h2>
        <button type="button" className="text-button" onClick={() => (open ? close() : setOpen(true))}>
          {open ? '접기' : '변경'}
        </button>
      </div>
      {open && isDemo && <p className="muted">데모 계정은 여러 사람이 같이 쓰는 계정이라 비밀번호를 바꿀 수 없습니다.</p>}
      {open && !isDemo && (
        <form className="form" onSubmit={submit} noValidate>
          <label className="field">
            <span>현재 비밀번호</span>
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <label className="field">
            <span>새 비밀번호({MIN_LENGTH}자 이상)</span>
            <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </label>
          <label className="field">
            <span>새 비밀번호 확인</span>
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
          <p className="muted">바꾸면 다른 기기의 로그인도 모두 끝나고, 새 비밀번호로 다시 로그인합니다.</p>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="sheet-actions">
            <button type="button" className="secondary-button" onClick={close} disabled={saving}>
              취소
            </button>
            <button type="submit" className="primary-button" disabled={saving || !current || !next || !confirm}>
              {saving ? '바꾸는 중…' : '변경'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
