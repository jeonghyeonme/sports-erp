import { FormEvent, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/use-auth';
import { describeError } from '../lib/errors';
import { PHONE_RE } from '../lib/format';
import { ApiEnvelope, LoginResult } from '../lib/types';

const MIN_PASSWORD = 8; // LinkMemberDto @MinLength(8)

// 지점 등록 회원의 앱 연동(POST /members/link, ADR-MEM-01) — 회원번호+전화번호가 둘 다 맞아야 하고,
// 회원번호당 1시간 5회까지 시도할 수 있다(LINK_ATTEMPTS_EXCEEDED). 성공하면 응답의 세션으로 바로 로그인한다(log/092).
export function LinkPage() {
  const { user, startSession } = useAuth();
  const [memberNo, setMemberNo] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!memberNo.trim()) return setError('회원번호를 입력해 주세요.');
    if (!PHONE_RE.test(phone.trim())) return setError('지점에 등록한 연락처를 010-1234-5678 형식으로 입력해 주세요.');
    if (!email.trim()) return setError('이메일을 입력해 주세요.');
    if (password.length < MIN_PASSWORD) return setError(`비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다.`);
    if (password !== confirm) return setError('비밀번호 확인이 일치하지 않습니다.');

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<ApiEnvelope<LoginResult>>('/members/link', {
        memberNo: memberNo.trim().toUpperCase(),
        phone: phone.trim(),
        email: email.trim(),
        password,
      });
      startSession(res.data.data!);
    } catch (err) {
      setError(describeError(err, '연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <header className="login-header">
        <p className="login-brand">스포이즘</p>
        <h1>지점 회원 앱 연결</h1>
        <p className="muted">지점에서 등록할 때 받은 회원번호와, 그때 적은 전화번호를 넣어 주세요.</p>
      </header>

      <form className="form" onSubmit={submit} noValidate>
        <label className="field">
          <span>회원번호</span>
          <input
            value={memberNo}
            placeholder="예: SEOCHO2025-014"
            autoCapitalize="characters"
            onChange={(e) => setMemberNo(e.target.value)}
          />
        </label>
        <label className="field">
          <span>등록한 전화번호</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="010-1234-5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="field">
          <span>이메일(로그인 아이디)</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>비밀번호({MIN_PASSWORD}자 이상)</span>
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="field">
          <span>비밀번호 확인</span>
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? '연결 중…' : '앱 계정 연결'}
        </button>
      </form>

      <p className="login-links">
        회원번호를 모르면 지점 데스크에 물어봐 주세요. 등록하지 않았다면 <Link to="/signup">새로 가입</Link>
      </p>
    </div>
  );
}
