import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { useApiList } from '../lib/use-api-list';
import { BranchSummary } from '../lib/types';
import { BriefcaseIcon, BuildingIcon, CalendarIcon, UsersIcon } from '../components/icons';

type Tone = 'blue' | 'violet' | 'emerald';

function KpiTile({ icon, tone, label, value }: { icon: ReactNode; tone: Tone; label: string; value: string }) {
  return (
    <div className="kpi-card">
      <span className={`icon-chip tone-${tone}`}>{icon}</span>
      <div>
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
      </div>
    </div>
  );
}

function BranchStat({ icon, tone, label, value }: { icon: ReactNode; tone: Tone; label: string; value: string }) {
  return (
    <div className="branch-stat">
      <span className={`icon-chip tone-${tone}`}>{icon}</span>
      <div>
        <div className="branch-stat-label">{label}</div>
        <div className="branch-stat-value">{value}</div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useApiList<BranchSummary>(['branches'], '/branches');

  const showTotals = (data?.length ?? 0) > 1;
  const totals = data?.reduce(
    (acc, b) => ({
      memberCount: acc.memberCount + b.memberCount,
      staffCount: acc.staffCount + b.staffCount,
      runningProgramCount: acc.runningProgramCount + b.runningProgramCount,
    }),
    { memberCount: 0, staffCount: 0, runningProgramCount: 0 },
  );

  return (
    <>
      <div className="page-header">
        <h2>대시보드</h2>
        <p className="page-desc">
          {user?.role === 'SUPER_ADMIN'
            ? '전체 지점 현황입니다. 지점 카드를 눌러 소속 직원·회원·프로그램을 확인하세요. (D2: SUPER_ADMIN만 모든 지점을 넘나들 수 있습니다)'
            : `${user?.branchName ?? '소속 지점'} 현황입니다. 지점 카드를 눌러 소속 직원·회원·프로그램을 확인하세요.`}
        </p>
      </div>

      {isLoading && <div className="loading-state">불러오는 중...</div>}

      {showTotals && totals && (
        <div className="kpi-grid">
          <KpiTile icon={<UsersIcon />} tone="blue" label="전체 회원" value={`${totals.memberCount}명`} />
          <KpiTile icon={<BriefcaseIcon />} tone="violet" label="전체 직원" value={`${totals.staffCount}명`} />
          <KpiTile
            icon={<CalendarIcon />}
            tone="emerald"
            label="진행중 프로그램"
            value={`${totals.runningProgramCount}개`}
          />
        </div>
      )}

      <div className="branch-grid">
        {data?.map((branch) => (
          <Link className="branch-card" to={`/branches/${branch.id}`} key={branch.id}>
            <div className="branch-card-header">
              <span className="icon-chip tone-blue">
                <BuildingIcon />
              </span>
              <h3>{branch.name}</h3>
            </div>
            <div className="branch-stats">
              <BranchStat icon={<UsersIcon />} tone="blue" label="회원 수" value={`${branch.memberCount}명`} />
              <BranchStat icon={<BriefcaseIcon />} tone="violet" label="직원 수" value={`${branch.staffCount}명`} />
              <BranchStat
                icon={<CalendarIcon />}
                tone="emerald"
                label="진행중 프로그램"
                value={`${branch.runningProgramCount}개`}
              />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
