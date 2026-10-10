import { useAuth } from '../lib/use-auth';
import { CongestionCard } from '../components/CongestionCard';
import { RecentNotices } from '../components/RecentNotices';
import { InstallCard } from '../components/InstallCard';

// 홈 — 혼잡도 카드와 최근 공지 3건(B1-3 사용자 결정, log/084). 호출 2회(시설 1 + 공지 1).
// 예약은 하단 탭에서 들어간다.
export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="stack">
      <section className="greeting">
        <h1>{user?.name}님, 안녕하세요</h1>
        <p className="muted">{user?.branchName ?? '소속 지점 정보 없음'}</p>
      </section>
      <InstallCard />
      <CongestionCard />
      <RecentNotices />
    </div>
  );
}
