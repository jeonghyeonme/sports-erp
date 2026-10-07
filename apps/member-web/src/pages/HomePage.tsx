import { useAuth } from '../lib/use-auth';

// B1-1 뼈대 — 로그인 후 빈 홈. 예약·공지·혼잡도 카드는 B1-2·B1-3에서 채운다(04_작업_브리프 B1).
export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="home">
      <section className="greeting">
        <h1>{user?.name}님, 안녕하세요</h1>
        <p className="muted">{user?.branchName ?? '소속 지점 정보 없음'}</p>
      </section>
      <section className="panel empty-state">
        <p>예약·공지·혼잡도 화면을 준비하고 있습니다.</p>
      </section>
    </div>
  );
}
