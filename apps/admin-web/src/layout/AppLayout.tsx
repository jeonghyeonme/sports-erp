import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { Role } from '../lib/types';

interface NavLinkItem {
  to: string;
  label: string;
}

interface NavGroupDef {
  label: string;
  items: NavLinkItem[];
}

type NavEntry = { kind: 'link'; link: NavLinkItem } | { kind: 'group'; group: NavGroupDef };

const link = (to: string, label: string): NavEntry => ({ kind: 'link', link: { to, label } });
const group = (label: string, items: NavLinkItem[]): NavEntry => ({ kind: 'group', group: { label, items } });

// 역할마다 접근 가능한 화면 구성 자체가 달라(01문서 §7 권한 매트릭스), 공유 목록을 필터링하는 대신
// 역할별로 그룹 구조를 따로 정의한다. 그룹명은 문서 카테고리가 아니라 그 역할이 "왜 이 화면을 쓰는가"
// 기준으로 붙였다 — 화면구성도(사이드바 역할별구성 v1) 승인안을 그대로 반영.
const NAV_BY_ROLE: Record<Role, NavEntry[]> = {
  SUPER_ADMIN: [
    link('/', '대시보드'),
    group('인사·권한', [
      { to: '/staff', label: '직원' },
      { to: '/permissions', label: '권한 관리' },
    ]),
    group('서비스 현황', [
      { to: '/members', label: '회원' },
      { to: '/programs', label: '프로그램' },
      { to: '/board', label: '게시판' },
      { to: '/facilities', label: '시설·혼잡도' },
    ]),
  ],
  BRANCH_ADMIN: [
    link('/', '대시보드'),
    group('회원 서비스', [
      { to: '/members', label: '회원' },
      { to: '/programs', label: '프로그램' },
    ]),
    group('인력 관리', [
      { to: '/staff', label: '직원' },
      { to: '/attendance', label: '근태관리' },
    ]),
    group('운영 지원', [
      { to: '/board', label: '게시판' },
      { to: '/facilities', label: '시설·혼잡도' },
    ]),
  ],
  // 03문서 §7 — SUPER_ADMIN은 현장 근태 운영에 직접 개입하지 않는 원칙이라 근태관리는 STAFF·BRANCH_ADMIN에만 있다.
  STAFF: [
    link('/', '대시보드'),
    link('/staff', '내 정보'),
    link('/attendance', '근태관리'),
    group('현장 정보(조회)', [
      { to: '/programs', label: '프로그램' },
      { to: '/board', label: '게시판' },
      { to: '/facilities', label: '시설·혼잡도' },
    ]),
  ],
  // MEMBER는 관리 화면 권한이 없어(대부분 API에서 403) "직원"·"권한관리"는 애초에 노출하지 않는다.
  MEMBER: [
    link('/', '대시보드'),
    link('/programs', '프로그램'),
    link('/board', '게시판'),
    link('/facilities', '시설·혼잡도'),
  ],
};

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: '본사 관리자',
  BRANCH_ADMIN: '지점 관리자',
  STAFF: '지점 직원',
  MEMBER: '회원',
};

function isPathActive(to: string, pathname: string): boolean {
  return to === '/' ? pathname === '/' : pathname.startsWith(to);
}

function NavGroupSection({
  group: groupDef,
  currentPath,
  collapsed,
  onToggle,
}: {
  group: NavGroupDef;
  currentPath: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  // 수동으로 접었어도 지금 보고 있는 화면이 이 그룹 안에 있으면 숨기지 않는다.
  const containsActive = groupDef.items.some((item) => isPathActive(item.to, currentPath));
  const isOpen = !collapsed || containsActive;

  return (
    <div className="nav-group">
      <button type="button" className="nav-group-head" onClick={onToggle} aria-expanded={isOpen}>
        <span>{groupDef.label}</span>
        <span className={isOpen ? 'chev open' : 'chev'}>▸</span>
      </button>
      {isOpen && (
        <div className="nav-group-items">
          {groupDef.items.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  // 접힌 그룹의 라벨만 기록(기본값 = 전부 펼침) — AppLayout은 로그인 세션 동안 계속 마운트돼 있어
  // 페이지를 이동해도 펼침 상태가 그대로 유지된다.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());

  if (!user) return null;

  const entries = NAV_BY_ROLE[user.role];

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">스포이즘 ERP</div>
        <nav>
          {entries.map((entry) =>
            entry.kind === 'link' ? (
              <NavLink key={entry.link.to} to={entry.link.to} end={entry.link.to === '/'}>
                {entry.link.label}
              </NavLink>
            ) : (
              <NavGroupSection
                key={entry.group.label}
                group={entry.group}
                currentPath={location.pathname}
                collapsed={collapsedGroups.has(entry.group.label)}
                onToggle={() => toggleGroup(entry.group.label)}
              />
            ),
          )}
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
