import { Link } from 'react-router-dom';
import { useAuth } from '../lib/use-auth';

// 홈은 API를 부르지 않는다(design-constants ⑩ — 방문당 약 10회). 공지·혼잡도 카드는 B1-3에서 더한다.
export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="stack">
      <section className="greeting">
        <h1>{user?.name}님, 안녕하세요</h1>
        <p className="muted">{user?.branchName ?? '소속 지점 정보 없음'}</p>
      </section>
      <Link to="/programs" className="panel link-card">
        <span className="link-card-title">프로그램 예약하기</span>
        <span className="muted">회차를 고르고 예약·결제합니다.</span>
      </Link>
      <Link to="/reservations" className="panel link-card">
        <span className="link-card-title">내 예약</span>
        <span className="muted">예약 확인과 취소</span>
      </Link>
    </div>
  );
}
