import { Link } from 'react-router-dom';

// RFP UI/UX "페이지 위치 정보를 MAP형태로 표시" — 지금 화면이 메뉴의 어디인지를 경로로 보인다(D51).
// 경로는 주소만으로 만든다: 사이드바 메뉴(역할별)에서 그룹·화면 이름을 찾고, 목록 아래 상세 화면은 이름을 하나 덧붙인다.
// 상세 화면의 대상 이름(회원 이름 등)은 각 화면 제목이 보여 주므로 여기서는 화면 종류만 쓴다.

export interface BreadcrumbNavItem {
  to: string;
  label: string;
  group?: string;
}

interface Crumb {
  label: string;
  to?: string;
}

// 목록 화면 아래의 상세 화면 이름. 지점 상세는 메뉴에 없고 대시보드에서 들어온다.
const DETAIL_LABEL: Record<string, string> = {
  '/members': '회원 상세',
  '/staff': '직원 상세',
  '/board': '게시글',
};

function buildTrail(items: BreadcrumbNavItem[], pathname: string): Crumb[] {
  const home: Crumb = { label: '홈', to: '/' };
  if (pathname === '/') return [{ label: '홈' }, { label: '대시보드' }];
  if (pathname.startsWith('/branches/')) return [home, { label: '대시보드', to: '/' }, { label: '지점 상세' }];

  const match = items
    .filter((i) => i.to !== '/' && (pathname === i.to || pathname.startsWith(i.to + '/')))
    .sort((a, b) => b.to.length - a.to.length)[0];
  if (!match) return [home];

  const trail: Crumb[] = [home];
  if (match.group) trail.push({ label: match.group });
  if (pathname === match.to) {
    trail.push({ label: match.label });
  } else {
    trail.push({ label: match.label, to: match.to });
    trail.push({ label: DETAIL_LABEL[match.to] ?? '상세' });
  }
  return trail;
}

export function Breadcrumb({ items, pathname }: { items: BreadcrumbNavItem[]; pathname: string }) {
  const trail = buildTrail(items, pathname);
  return (
    <nav className="breadcrumb" aria-label="현재 위치">
      <ol>
        {trail.map((c, i) => {
          const last = i === trail.length - 1;
          return (
            <li key={`${i}-${c.label}`} aria-current={last ? 'page' : undefined}>
              {c.to && !last ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
