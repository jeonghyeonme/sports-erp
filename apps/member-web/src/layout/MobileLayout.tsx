import { Outlet } from 'react-router-dom';
import { useAuth } from '../lib/use-auth';

// D41 결정 4 — 기준 폭 360px 모바일 셸. 상단 바(지점명·로그아웃) + 본문. 하단 탭은 화면이 생기는 B1-2부터 붙인다.
export function MobileLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="mobile-shell">
      <header className="app-bar">
        <div className="app-bar-title">
          <span className="app-bar-brand">스포이즘</span>
          {user?.branchName && <span className="app-bar-branch">{user.branchName}</span>}
        </div>
        <button type="button" className="text-button" onClick={() => void logout()}>
          로그아웃
        </button>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
