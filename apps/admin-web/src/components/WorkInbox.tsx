import { Link } from 'react-router-dom';
import { useApiList } from '../lib/use-api-list';
import { InboxItem } from '../lib/types';

// D61 — 처리 대기함. 대시보드 첫 카드로 "지금 내가 처리할 일"의 건수를 보이고, 누르면 그 화면으로 간다.
// 건수만 받는다(GET /inbox 1회) — 목록은 각 화면이 보여 준다. 창으로 돌아오면 react-query가 다시 받는다.
export function WorkInbox() {
  const { data, isLoading, isError } = useApiList<InboxItem>(['inbox'], '/inbox');
  if (isError) return null; // 대기함이 실패해도 대시보드는 그대로 쓴다
  const pending = (data ?? []).filter((i) => i.count > 0);

  return (
    <div className="card inbox-card" style={{ marginBottom: 16 }}>
      <h3>처리 대기</h3>
      {isLoading && <div className="loading-state">불러오는 중...</div>}
      {!isLoading && pending.length === 0 && <p className="page-desc" style={{ margin: 0 }}>지금 처리할 일이 없습니다.</p>}
      {pending.length > 0 && (
        <ul className="inbox-list">
          {pending.map((i) => (
            <li key={i.key}>
              <Link to={i.link} className="inbox-item">
                <span>{i.label}</span>
                <strong className="inbox-count">{i.count}건</strong>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
