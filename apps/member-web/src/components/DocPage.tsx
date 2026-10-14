import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

// 로그인 전에도 여는 안내 문서 화면(이용 안내·개인정보처리방침, D51) — 하단 탭 없이 혼자 뜬다.
// 앞 화면이 이 앱 안이면 그리로, 주소로 바로 들어왔으면 첫 화면으로 돌아간다.
export function DocPage({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  const navigate = useNavigate();
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'));

  return (
    <div className="login-page doc-page">
      <button type="button" className="text-button doc-back" onClick={back}>
        ← 돌아가기
      </button>
      <header className="login-header">
        <p className="login-brand">스포이즘</p>
        <h1>{title}</h1>
        {lead && <p className="muted">{lead}</p>}
      </header>
      <div className="stack">{children}</div>
    </div>
  );
}
