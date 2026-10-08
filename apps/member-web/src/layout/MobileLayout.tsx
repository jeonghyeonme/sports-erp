import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/use-auth';

// D41 결정 4 — 기준 폭 360px 모바일 셸. 상단 바(지점명·로그아웃) + 본문 + 하단 탭(B1-2 사용자 결정, log/083).
// 공지·혼잡도·내 정보 탭은 B1-3에서 더한다.
const TABS = [
  { to: '/', label: '홈', end: true },
  { to: '/programs', label: '예약하기', end: false },
  { to: '/reservations', label: '내 예약', end: false },
];

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
      <nav className="tab-bar" aria-label="주요 메뉴">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className="tab-link">
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
