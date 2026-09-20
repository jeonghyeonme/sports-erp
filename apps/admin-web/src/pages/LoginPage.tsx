import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/use-auth';

// prisma/seed.ts의 SHEET04 시나리오 계정 + 지점 격리 시연용 강남점 관리자 계정(mock-data.service.ts 참고).
const DEMO_ACCOUNTS = [
  { email: 'jeong.haneul@spoism.example', label: '정하늘 · SUPER_ADMIN(본사)' },
  { email: 'kim.minsu@spoism.example', label: '김민수 · BRANCH_ADMIN(서초점)' },
  { email: 'choi.gangnam@spoism.example', label: '최강남 · BRANCH_ADMIN(강남점)' },
  { email: 'park.seoyeon@spoism.example', label: '박서연 · STAFF(서초점 트레이너)' },
  { email: 'lee.sujin@example.com', label: '이수진 · MEMBER(서초점 회원)' },
];
const DEMO_PASSWORD = 'demo-password-1234';

export function LoginPage() {
  const { user, login, isLoading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch {
      // 에러 메시지는 useAuth().error로 이미 노출됨
    }
  };

  const loginAsDemo = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    try {
      await login(demoEmail, DEMO_PASSWORD);
    } catch {
      // no-op
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>스포이즘 ERP</h1>
        <p className="subtitle">지점 관리자 웹 · Phase 1 구조 데모</p>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn-primary" type="submit" disabled={isLoading}>
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="demo-accounts">
          <p>데모 계정으로 바로 체험하기 (비밀번호 공통: {DEMO_PASSWORD})</p>
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              className="demo-account-btn"
              onClick={() => loginAsDemo(acc.email)}
              disabled={isLoading}
            >
              <span>{acc.label}</span>
              <span>→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
