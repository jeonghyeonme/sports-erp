import { useAuth } from '../lib/auth-context';
import { useApiList } from '../lib/use-api-list';
import { BranchSummary } from '../lib/types';

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useApiList<BranchSummary>(['branches'], '/branches');

  return (
    <>
      <h2>대시보드</h2>
      <p className="page-desc">
        {user?.role === 'SUPER_ADMIN'
          ? '전체 지점 현황입니다. (D2: SUPER_ADMIN만 모든 지점을 넘나들 수 있습니다)'
          : `${user?.branchName ?? '소속 지점'} 현황입니다. (본인 지점 데이터만 자동으로 필터링됩니다)`}
      </p>

      {isLoading && <div className="loading-state">불러오는 중...</div>}

      <div className="card-grid">
        {data?.map((branch) => (
          <div className="card" key={branch.id}>
            <h3>{branch.name}</h3>
            <div className="stat-row">
              <span>회원 수</span>
              <strong>{branch.memberCount}명</strong>
            </div>
            <div className="stat-row">
              <span>직원 수</span>
              <strong>{branch.staffCount}명</strong>
            </div>
            <div className="stat-row">
              <span>진행중 프로그램</span>
              <strong>{branch.runningProgramCount}개</strong>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
