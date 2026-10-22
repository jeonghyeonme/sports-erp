import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/use-auth';
import { useCan } from '../lib/use-can';
import { ApiEnvelope, InboxItem, Role } from '../lib/types';
import { api } from '../lib/api';
import { findScreenHelp } from '../lib/help-content';
import { HelpPanel } from '../components/HelpPanel';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { Breadcrumb, BreadcrumbNavItem } from '../components/Breadcrumb';

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

// 역할마다 접근 가능한 화면 구성 자체가 달라(권한관리 A-7 권한 매트릭스), 공유 목록을 필터링하는 대신
// 역할별로 그룹 구조를 따로 정의한다. 그룹명은 문서 카테고리가 아니라 그 역할이 "왜 이 화면을 쓰는가"
// 기준으로 붙였다 — 화면구성도(사이드바 역할별구성 v1) 승인안을 그대로 반영.
const NAV_BY_ROLE: Record<Role, NavEntry[]> = {
  SUPER_ADMIN: [
    link('/', '대시보드'),
    group('인사·권한', [
      { to: '/staff', label: '직원' },
      // RFP 개념도 본사→현장 근태관리 — 본사는 조회만(근태관리 A-7 수정, log/114)
      { to: '/attendance', label: '근태 현황' },
      { to: '/permissions', label: '권한 관리' },
      // D44 — 인사 변경 감사 기록(본사 전용)
      { to: '/audit-logs', label: '변경 이력' },
    ]),
    group('서비스 현황', [
      { to: '/members', label: '회원' },
      { to: '/programs', label: '프로그램' },
      { to: '/instructors', label: '강사' },
      { to: '/board', label: '게시판' },
      { to: '/facilities', label: '시설·혼잡도' },
      { to: '/assets', label: '자산·비품' },
      { to: '/documents', label: '문서함' },
      // D56 — 현장이 올린 업무지원 요청 처리
      { to: '/support-requests', label: '업무지원 요청' },
    ]),
  ],
  BRANCH_ADMIN: [
    link('/', '대시보드'),
    group('회원 서비스', [
      { to: '/members', label: '회원' },
      { to: '/programs', label: '프로그램' },
      { to: '/instructors', label: '강사' },
      { to: '/reservations', label: '예약 관리' },
    ]),
    group('인력 관리', [
      { to: '/staff', label: '직원' },
      { to: '/attendance', label: '근태관리' },
    ]),
    group('운영 지원', [
      { to: '/board', label: '게시판' },
      { to: '/facilities', label: '시설·혼잡도' },
      { to: '/assets', label: '자산·비품' },
      { to: '/documents', label: '문서함' },
      { to: '/support-requests', label: '업무지원 요청' },
    ]),
  ],
  // 근태관리 A-7 — SUPER_ADMIN은 현장 근태를 조회만 한다(위 "근태 현황"). 출퇴근·승인·확정 화면은 STAFF·BRANCH_ADMIN만.
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
    link('/reservations', '예약'),
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

// D60 3단계 — 화면마다 조회 권한이 꺼지면 메뉴를 숨긴다. 근태관리·직원(내 정보)·대시보드는 본인 업무가 섞여 있어 숨기지 않는다.
const MENU_FEATURE: Record<string, string> = {
  '/members': 'member',
  '/programs': 'program',
  '/instructors': 'instructor',
  '/reservations': 'reservation',
  '/board': 'post',
  '/facilities': 'facility',
  '/assets': 'asset',
  '/documents': 'document',
  '/support-requests': 'support',
};

function visibleNav(entries: NavEntry[], canRead: (to: string) => boolean): NavEntry[] {
  return entries.flatMap((e): NavEntry[] => {
    if (e.kind === 'link') return canRead(e.link.to) ? [e] : [];
    const items = e.group.items.filter((item) => canRead(item.to));
    return items.length > 0 ? [{ kind: 'group', group: { ...e.group, items } }] : [];
  });
}

// 경로 표시(D51)가 쓰는 평평한 메뉴 목록 — 그룹 안 화면은 그룹 이름을 함께 넘긴다.
function flattenNav(entries: NavEntry[]): BreadcrumbNavItem[] {
  return entries.flatMap((e) =>
    e.kind === 'link' ? [e.link] : e.group.items.map((item) => ({ ...item, group: e.group.label })),
  );
}

function isPathActive(to: string, pathname: string): boolean {
  return to === '/' ? pathname === '/' : pathname.startsWith(to);
}

// D61 — 처리 대기 건수를 그 일을 처리하는 메뉴 옆에 숫자로 붙인다(대기함 항목의 link와 같은 경로).
function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="nav-badge" aria-label={`처리 대기 ${count}건`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

function NavGroupSection({
  group: groupDef,
  currentPath,
  collapsed,
  onToggle,
  badgeOf,
}: {
  group: NavGroupDef;
  currentPath: string;
  collapsed: boolean;
  onToggle: () => void;
  badgeOf: (to: string) => number;
}) {
  const groupTotal = groupDef.items.reduce((sum, item) => sum + badgeOf(item.to), 0);
  // 수동으로 접었어도 지금 보고 있는 화면이 이 그룹 안에 있으면 숨기지 않는다.
  const containsActive = groupDef.items.some((item) => isPathActive(item.to, currentPath));
  const isOpen = !collapsed || containsActive;

  return (
    <div className="nav-group">
      <button type="button" className="nav-group-head" onClick={onToggle} aria-expanded={isOpen}>
        <span>{groupDef.label}</span>
        <span className="nav-group-tail">
          {/* 접혀 있으면 그룹 머리에 합계를 보인다 */}
          {!isOpen && <NavBadge count={groupTotal} />}
          <span className={isOpen ? 'chev open' : 'chev'}>▸</span>
        </span>
      </button>
      {isOpen && (
        <div className="nav-group-items">
          {groupDef.items.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
              <NavBadge count={badgeOf(item.to)} />
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const can = useCan();
  const location = useLocation();
  // 접힌 그룹의 라벨만 기록(기본값 = 전부 펼침) — AppLayout은 로그인 세션 동안 계속 마운트돼 있어
  // 페이지를 이동해도 펼침 상태가 그대로 유지된다.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  // 화면별 도움말(log/089) — 열린 채로 다른 화면으로 가면 그 화면 도움말로 바뀐다(경로로 매번 찾음).
  const [helpOpen, setHelpOpen] = useState(false);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const [showPassword, setShowPassword] = useState(false);

  // D61 — 처리 대기 건수(대시보드 카드와 같은 캐시 ['inbox']). 화면을 옮길 때 30초보다 오래된 값이면 다시 받는다 —
  // 승인·처리 뒤 배지가 줄어들게 하면서, 이동마다 요청을 늘리지 않는다(방문당 호출 가정 D40 ⑩).
  const queryClient = useQueryClient();
  const inbox = useQuery<InboxItem[]>({
    queryKey: ['inbox'],
    enabled: !!user && user.role !== 'MEMBER' && !user.mustChangePassword,
    staleTime: 30_000,
    queryFn: async () => (await api.get<ApiEnvelope<InboxItem[]>>('/inbox')).data.data ?? [],
  });
  useEffect(() => {
    void queryClient.refetchQueries({ queryKey: ['inbox'], stale: true, type: 'active' });
  }, [location.pathname, queryClient]);
  const badgeOf = (to: string) => (inbox.data ?? []).filter((i) => i.link === to).reduce((sum, i) => sum + i.count, 0);
  const inboxTotal = (inbox.data ?? []).reduce((sum, i) => sum + i.count, 0);

  if (!user) return null;
  // 보안-6(log/164) — 임시 비밀번호 상태면 업무 화면을 그리지 않고 변경 창만 보인다(서버도 업무 API를 403으로 막는다).
  // 바꾸면 서버가 세션을 끊으므로 새 비밀번호로 다시 로그인한다. 창을 닫으면 로그아웃.
  if (user.mustChangePassword) return <ChangePasswordModal forced onClose={() => logout()} />;

  const entries = visibleNav(NAV_BY_ROLE[user.role], (to) => !MENU_FEATURE[to] || can(MENU_FEATURE[to], 'READ'));

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
                <NavBadge count={badgeOf(entry.link.to)} />
              </NavLink>
            ) : (
              <NavGroupSection
                key={entry.group.label}
                group={entry.group}
                currentPath={location.pathname}
                collapsed={collapsedGroups.has(entry.group.label)}
                onToggle={() => toggleGroup(entry.group.label)}
                badgeOf={badgeOf}
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
          <div className="topbar-actions">
            {/* D61 — 처리할 일이 있으면 합계를 보이고, 누르면 대시보드 처리 대기 카드로 */}
            {inboxTotal > 0 && (
              <NavLink to="/" end className="inbox-pill" aria-label={`처리 대기 ${inboxTotal}건`}>
                처리 대기 <strong>{inboxTotal > 99 ? '99+' : inboxTotal}</strong>
              </NavLink>
            )}
            <button
              type="button"
              className={helpOpen ? 'help-btn active' : 'help-btn'}
              onClick={() => setHelpOpen((v) => !v)}
              aria-expanded={helpOpen}
            >
              ? 도움말
            </button>
            <button type="button" className="logout-btn" onClick={() => setShowPassword(true)}>
              비밀번호 변경
            </button>
            <button className="logout-btn" onClick={() => logout()}>
              로그아웃
            </button>
          </div>
        </header>
        <div className={helpOpen ? 'content-row with-help' : 'content-row'}>
          <main className="content">
            <Breadcrumb items={flattenNav(entries)} pathname={location.pathname} />
            <Outlet />
          </main>
          {showPassword && <ChangePasswordModal onClose={() => setShowPassword(false)} />}
          {helpOpen && <HelpPanel help={findScreenHelp(location.pathname)} role={user.role} onClose={closeHelp} />}
        </div>
      </div>
    </div>
  );
}
