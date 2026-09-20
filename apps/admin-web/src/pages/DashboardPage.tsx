import { ReactNode, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/use-auth';
import { useApiList } from '../lib/use-api-list';
import { BranchContractStatus, BranchSummary } from '../lib/types';
import { AlertTriangleIcon, BriefcaseIcon, BuildingIcon, CalendarIcon, UsersIcon } from '../components/icons';
import { CollapsibleBranchSection } from '../components/CollapsibleBranchSection';
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_RANK } from '../lib/contract-status';

const STATUS_FILTERS: Array<{ value: BranchContractStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'ACTIVE', label: '정상' },
  { value: 'RENEWAL_DUE', label: '갱신임박' },
  { value: 'EXPIRED', label: '만료' },
  { value: 'TERMINATED', label: '종료' },
];

// 히스토리 시계열 API가 아직 없어(3-1문서 §5 예고 항목), 현재값에서 역산한 임시 추세를 스파크라인에 표시한다.
// 실제 기간별 집계가 붙기 전까지의 디자인 확인용 자리값.
function mockTrend(current: number): number[] {
  const shape = [0.86, 0.9, 0.83, 0.94, 0.97, 0.92, 1];
  return shape.map((ratio) => Math.round(current * ratio));
}

function Sparkline({ points }: { points: number[] }) {
  const width = 64;
  const height = 22;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - ((p - min) / range) * height).toFixed(1)}`)
    .join(' ');
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function KpiTile({ icon, label, value, current }: { icon: ReactNode; label: string; value: string; current: number }) {
  const trend = mockTrend(current);
  const delta = trend[0] === 0 ? 0 : ((trend[trend.length - 1] - trend[0]) / trend[0]) * 100;
  const up = delta >= 0;
  return (
    <div className="kpi-panel">
      <div className="kpi-panel-top">
        <span className="icon-chip">{icon}</span>
        <span className={`kpi-delta ${up ? 'up' : 'down'}`}>
          {up ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
        </span>
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-panel-bottom">
        <div className="kpi-value">{value}</div>
        <Sparkline points={trend} />
      </div>
    </div>
  );
}

// 계약 갱신 임박 — 추세가 아니라 "지금 리스크가 몇 건인가"를 보는 지표라 스파크라인 대신
// 값이 있을 때만 경고 톤으로 강조한다(01문서 §2-1: 본사 대시보드 "갱신 임박 지점" 알림 카드).
// 클릭하면 아래 지점 테이블이 갱신임박 필터로 좁혀진다.
function AlertKpiTile({ label, value, alarmed, onClick }: { label: string; value: string; alarmed: boolean; onClick: () => void }) {
  return (
    <div
      className={`kpi-panel${alarmed ? ' kpi-panel-alarm' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      style={{ cursor: 'pointer' }}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="kpi-panel-top">
        <span className={`icon-chip${alarmed ? ' icon-chip-warning' : ''}`}>
          <AlertTriangleIcon />
        </span>
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

function BranchStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="branch-stat">
      <span className="icon-chip">{icon}</span>
      <div>
        <div className="branch-stat-label">{label}</div>
        <div className="branch-stat-value">{value}</div>
      </div>
    </div>
  );
}

// 지점이 여럿(SUPER_ADMIN)일 때 쓰는 검색/필터 가능한 지역별 그룹 테이블 — 98개 지점 규모에서도
// 스캔 가능하도록, 지역(서울/경기/부산 등)으로 접어두고 지역 안에서는 위험도(만료>갱신임박>정상>종료)
// 우선 정렬을 항상 적용한다. 검색어나 상태 필터가 걸리면 좁혀진 지역은 바로 펼쳐서 보여준다.
function BranchTable({ branches, statusFilter, onStatusFilterChange }: {
  branches: BranchSummary[];
  statusFilter: BranchContractStatus | 'ALL';
  onStatusFilterChange: (v: BranchContractStatus | 'ALL') => void;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const filtering = search.trim() !== '' || statusFilter !== 'ALL';

  const regionGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = branches
      .filter((b) => statusFilter === 'ALL' || b.contractStatus === statusFilter)
      .filter((b) => !term || b.name.toLowerCase().includes(term))
      .sort((a, b) => {
        const rankDiff = CONTRACT_STATUS_RANK[a.contractStatus] - CONTRACT_STATUS_RANK[b.contractStatus];
        return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name, 'ko');
      });

    const groups = new Map<string, BranchSummary[]>();
    for (const b of rows) {
      const list = groups.get(b.region);
      if (list) list.push(b);
      else groups.set(b.region, [b]);
    }
    return [...groups.entries()]
      .map(([region, regionRows]) => ({ region, rows: regionRows }))
      .sort((a, b) => b.rows.length - a.rows.length || a.region.localeCompare(b.region, 'ko'));
  }, [branches, search, statusFilter]);

  return (
    <>
      <div className="list-toolbar">
        <input
          className="search-input"
          placeholder="지점명 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-chips">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              className={`filter-chip${statusFilter === f.value ? ' active' : ''}`}
              onClick={() => onStatusFilterChange(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {regionGroups.length === 0 && <div className="empty-state">검색 결과가 없습니다.</div>}

      {regionGroups.map((g) => (
        <CollapsibleBranchSection
          key={g.region}
          branchName={g.region}
          count={g.rows.length}
          countLabel="개 지점"
          defaultExpanded={filtering}
        >
          <table>
            <thead>
              <tr>
                <th>지점명</th>
                <th>계약상태</th>
                <th>회원수</th>
                <th>직원수</th>
                <th>진행중 프로그램</th>
                <th>계약만료일</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((b) => (
                <tr className="branch-row" key={b.id} onClick={() => navigate(`/branches/${b.id}`)}>
                  <td className="branch-row-name">{b.name}</td>
                  <td>
                    <span className={`badge ${b.contractStatus}`}>{CONTRACT_STATUS_LABEL[b.contractStatus]}</span>
                  </td>
                  <td>{b.memberCount}명</td>
                  <td>{b.staffCount}명</td>
                  <td>{b.runningProgramCount}개</td>
                  <td>{b.contractEndAt ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CollapsibleBranchSection>
      ))}
    </>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useApiList<BranchSummary>(['branches'], '/branches');
  const [statusFilter, setStatusFilter] = useState<BranchContractStatus | 'ALL'>('ALL');

  const showTable = (data?.length ?? 0) > 1;
  const branchCount = data?.length ?? 0;
  const totals = data?.reduce(
    (acc, b) => ({
      memberCount: acc.memberCount + b.memberCount,
      staffCount: acc.staffCount + b.staffCount,
      runningProgramCount: acc.runningProgramCount + b.runningProgramCount,
      renewalDueCount: acc.renewalDueCount + (b.contractStatus === 'RENEWAL_DUE' ? 1 : 0),
    }),
    { memberCount: 0, staffCount: 0, runningProgramCount: 0, renewalDueCount: 0 },
  );

  return (
    <>
      <div className="page-header">
        <h2>대시보드</h2>
        <p className="page-desc">
          {user?.role === 'SUPER_ADMIN'
            ? '전체 지점 현황입니다. 지역별로 묶어서 보여줍니다 — 검색·필터하거나 행을 눌러 소속 직원·회원·프로그램·혼잡도를 확인하세요. (D2: SUPER_ADMIN만 모든 지점을 넘나들 수 있습니다)'
            : `${user?.branchName ?? '소속 지점'} 현황입니다. 지점 카드를 눌러 소속 직원·회원·프로그램·혼잡도를 확인하세요.`}
        </p>
      </div>

      {isLoading && <div className="loading-state">불러오는 중...</div>}

      {showTable && totals && (
        <div className="kpi-grid">
          <KpiTile icon={<BuildingIcon />} label="전체 지점 수" value={`${branchCount}개`} current={branchCount} />
          <KpiTile icon={<BriefcaseIcon />} label="전체 직원 수" value={`${totals.staffCount}명`} current={totals.staffCount} />
          <AlertKpiTile
            label="계약 갱신 임박 지점"
            value={`${totals.renewalDueCount}개`}
            alarmed={totals.renewalDueCount > 0}
            onClick={() => setStatusFilter('RENEWAL_DUE')}
          />
        </div>
      )}

      {showTable ? (
        <BranchTable branches={data ?? []} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} />
      ) : (
        <div className="branch-grid">
          {data?.map((branch) => (
            <Link className="branch-card" to={`/branches/${branch.id}`} key={branch.id}>
              <div className="branch-card-header">
                <span className="icon-chip">
                  <BuildingIcon />
                </span>
                <h3>{branch.name}</h3>
                <span className={`badge ${branch.contractStatus}`}>
                  {CONTRACT_STATUS_LABEL[branch.contractStatus]}
                </span>
              </div>
              <div className="branch-stats">
                <BranchStat icon={<UsersIcon />} label="회원 수" value={`${branch.memberCount}명`} />
                <BranchStat icon={<BriefcaseIcon />} label="직원 수" value={`${branch.staffCount}명`} />
                <BranchStat
                  icon={<CalendarIcon />}
                  label="진행중 프로그램"
                  value={`${branch.runningProgramCount}개`}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
