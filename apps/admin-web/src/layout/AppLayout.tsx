import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Role } from '../lib/types';

interface NavItem {
  to: string;
  label: string;
  roles?: Role[]; // 없으면 전체 역할에 노출
}

// 01문서 §7 권한 매트릭스를 그대로 반영한 메뉴 노출 규칙.
const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '대시보드' },
  { to: '/members', label: '회원', roles: ['SUPER_ADMIN', 'BRANCH_ADMIN'] },
  { to: '/staff', label: '직원' },
  { to: '/programs', label: '프로그램' },
  { to: '/board', label: '게시판' },
  { to: '/facilities', label: '시설·혼잡도' },
];

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: '본사 관리자',
  BRANCH_ADMIN: '지점 관리자',
  STAFF: '지점 직원',
  MEMBER: '회원',
};

export function AppLayout() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">스포이즘 ERP</div>
        <nav>
          {visibleItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="who">
            {user.name}
            <span className="role-badge">{ROLE_LABEL[user.role]}</span>
            {user.branchName && <span className="role-badge">{user.branchName}</span>}
          </div>
          <button className="logout-btn" onClick={logout}>
            로그아웃
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
