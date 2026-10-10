import { ReactNode, TouchEvent, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/use-auth';
import { clearLoadCache } from '../lib/use-load';
import { OfflineBanner } from '../components/OfflineBanner';
import { BackIcon, CalendarPlusIcon, HomeIcon, RefreshIcon, TicketIcon, UserIcon } from '../components/Icons';

// D41 결정 4 — 기준 폭 360px 모바일 셸. 하단 탭(B1-2, log/083)·내 정보 탭(B1-3, log/084).
// log/094 앱 셸: 탭 아이콘, 하위 화면의 뒤로 가기 앱 바, 화면 전환 애니메이션, 당겨서 새로고침, 오프라인 띠.
const TABS: Array<{ to: string; label: string; end: boolean; icon: ReactNode }> = [
  { to: '/', label: '홈', end: true, icon: <HomeIcon /> },
  { to: '/programs', label: '예약하기', end: false, icon: <CalendarPlusIcon /> },
  { to: '/reservations', label: '내 예약', end: false, icon: <TicketIcon /> },
  { to: '/me', label: '내 정보', end: false, icon: <UserIcon /> },
];

// 하위 화면(탭 루트가 아닌 곳)은 앱 바에 뒤로 가기와 제목을 둔다 — 탭 루트는 큰 제목을 본문이 보인다.
const SUB_PAGES: Array<{ match: RegExp; title: string; parent: string }> = [
  { match: /^\/programs\/[^/]+$/, title: '회차 선택', parent: '/programs' },
  { match: /^\/pay\/[^/]+$/, title: '결제', parent: '/reservations' },
  { match: /^\/notices$/, title: '공지', parent: '/' },
  { match: /^\/notices\/[^/]+$/, title: '공지', parent: '/notices' },
];

const PULL_TRIGGER = 72; // 이만큼(px) 당기면 놓을 때 새로고침
const PULL_MAX = 110;

export function MobileLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const sub = SUB_PAGES.find((p) => p.match.test(location.pathname));

  // 당겨서 새로고침 — 맨 위에서 아래로 끌면 화면을 다시 그리며 다시 불러온다(홈 60초 캐시도 비운다, log/085).
  // 홈 화면 아이콘으로 연 앱에는 브라우저의 당겨서 새로고침이 없어서 직접 둔다.
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const startY = useRef<number | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    startY.current = window.scrollY <= 0 && !refreshing ? e.touches[0].clientY : null;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    setPull(dy > 0 ? Math.min(PULL_MAX, dy * 0.5) : 0);
  };
  const onTouchEnd = () => {
    if (startY.current !== null && pull >= PULL_TRIGGER) {
      setRefreshing(true);
      clearLoadCache();
      setRefreshKey((k) => k + 1);
      window.setTimeout(() => setRefreshing(false), 600);
    }
    startY.current = null;
    setPull(0);
  };

  const indicator = refreshing ? 48 : pull;

  return (
    <div className="mobile-shell" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <header className="app-bar">
        {sub ? (
          <>
            <button
              type="button"
              className="icon-button"
              aria-label="뒤로"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(sub.parent))}
            >
              <BackIcon />
            </button>
            <span className="app-bar-heading">{sub.title}</span>
            <span className="icon-button-spacer" />
          </>
        ) : (
          <div className="app-bar-title">
            <img src="/m/assets/icons/favicon-48.png" alt="" width={28} height={28} className="app-bar-logo" />
            <div>
              <span className="app-bar-brand">스포이즘</span>
              {user?.branchName && <span className="app-bar-branch">{user.branchName}</span>}
            </div>
          </div>
        )}
      </header>
      <OfflineBanner />
      <div className="pull-indicator" style={{ height: indicator }} aria-hidden={indicator === 0}>
        <span style={{ transform: `rotate(${pull * 3}deg)`, opacity: Math.min(1, indicator / PULL_TRIGGER) }}>
          <RefreshIcon spinning={refreshing} />
        </span>
      </div>
      <main className="app-main">
        <div key={`${location.pathname}#${refreshKey}`} className="page-enter">
          <Outlet />
        </div>
      </main>
      <nav className="tab-bar" aria-label="주요 메뉴">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className="tab-link">
            {tab.icon}
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
