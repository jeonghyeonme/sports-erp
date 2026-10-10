import { FormEvent, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/use-auth';
import { SESSION_EXPIRED_MESSAGE } from '../lib/errors';
import { Splash } from '../components/Splash';
import { OfflineBanner } from '../components/OfflineBanner';
import { DEMO_MEMBER } from '../lib/demo-account';

export function LoginPage() {
  const { user, isRestoring, sessionExpired, loginNotice, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;
  if (isRestoring) return <Splash />;

  const submit = async (loginEmail: string, loginPassword: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await login(loginEmail, loginPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(email.trim(), password);
  };

  // 시연용 — 데모 회원 계정으로 바로 들어간다(입력란도 채워 어떤 계정인지 보이게 한다).
  const loginAsDemo = () => {
    setEmail(DEMO_MEMBER.email);
    setPassword(DEMO_MEMBER.password);
    void submit(DEMO_MEMBER.email, DEMO_MEMBER.password);
  };

  return (
    <div className="login-page">
      <OfflineBanner />
      <header className="login-header">
        <p className="login-brand">스포이즘</p>
        <h1>회원 로그인</h1>
        <p className="muted">등록한 지점의 프로그램 예약과 공지를 확인하세요.</p>
      </header>

      {loginNotice && !error && (
        <p className="notice" role="status">
          {loginNotice}
        </p>
      )}
      {sessionExpired && !error && (
        <p className="notice" role="status">
          {SESSION_EXPIRED_MESSAGE}
        </p>
      )}

      <form className="form" onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span>이메일</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary-button" disabled={submitting || !email || !password}>
          {submitting ? '로그인 중…' : '로그인'}
        </button>
      </form>

      <div className="demo-login">
        <p className="muted">시연용 계정이 준비돼 있어요</p>
        <button type="button" className="secondary-button" onClick={loginAsDemo} disabled={submitting}>
          데모 회원으로 둘러보기 ({DEMO_MEMBER.label})
        </button>
      </div>

      <p className="login-links">
        처음 오셨나요? <Link to="/join">가입·지점 회원 연결</Link>
      </p>
    </div>
  );
}
