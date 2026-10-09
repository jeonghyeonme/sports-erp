import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/use-auth';

// 처음 오는 회원의 첫 화면(log/092, 사용자 결정) — 지점에서 이미 등록했는지 먼저 묻는다.
// 지점 등록 회원이 새로 가입하면 같은 사람이 회원 두 명이 되므로(ADR-MEM-01) 연동을 먼저 보인다. 요청은 보내지 않는다.
export function JoinPage() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="login-page">
      <header className="login-header">
        <p className="login-brand">스포이즘</p>
        <h1>처음 오셨나요?</h1>
        <p className="muted">지점 데스크에서 회원 등록을 하셨는지에 따라 시작하는 방법이 다릅니다.</p>
      </header>

      <div className="stack">
        <Link className="choice-card" to="/link">
          <strong>지점에서 이미 회원 등록을 했어요</strong>
          <span>등록할 때 받은 회원번호와 전화번호로 앱 계정을 연결합니다. 수강·PT 내역이 그대로 보입니다.</span>
        </Link>
        <Link className="choice-card" to="/signup">
          <strong>아직 등록하지 않았어요</strong>
          <span>다닐 지점을 고르고 새로 가입합니다.</span>
        </Link>
      </div>

      <p className="login-links">
        이미 계정이 있나요? <Link to="/login">로그인</Link>
      </p>
    </div>
  );
}
