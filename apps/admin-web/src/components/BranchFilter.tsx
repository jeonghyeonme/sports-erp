import { useApiList } from '../lib/use-api-list';
import { BranchSummary } from '../lib/types';

// D43 목록 화면(회원·자산)의 지점 선택 — 본사 관리자만 쓴다(지점 관리자는 서버가 자기 지점으로 강제한다).
// 지점 목록은 다른 화면과 같은 쿼리 키라 캐시를 공유한다. 값 ''은 "전체 지점".
export function BranchFilter({ value, onChange }: { value: string; onChange: (branchId: string) => void }) {
  const { data } = useApiList<BranchSummary>(['branches'], '/branches');
  return (
    <select className="role-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label="지점">
      <option value="">전체 지점</option>
      {(data ?? []).map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
