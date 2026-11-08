import { ReactNode, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/use-auth';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { ApiEnvelope, BranchContractStatus, BranchSummary, CompanyPerformance, MonthlyPerformance } from '../lib/types';
import { AlertTriangleIcon, BriefcaseIcon, BuildingIcon, CalendarIcon, UsersIcon } from '../components/icons';
import { CollapsibleBranchSection } from '../components/CollapsibleBranchSection';
import { WorkInbox } from '../components/WorkInbox';
import { BranchCreateModal } from '../components/BranchCreateModal';
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_RANK } from '../lib/contract-status';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCan } from '../lib/use-can';
import { PerformanceCharts, PerformanceStatTiles } from '../components/charts/PerformanceCharts';
import { RankedBarChart } from '../components/charts/RankedBarChart';
import { monthLabel } from '../lib/chart-scale';

const AUTO_EXPAND_MAX_BRANCHES = 10;

const STATUS_FILTERS: Array<{ value: BranchContractStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'ACTIVE', label: '정상' },
  { value: 'RENEWAL_DUE', label: '갱신임박' },
  { value: 'EXPIRED', label: '만료' },
  { value: 'TERMINATED', label: '종료' },
];

// log/125 F4 — 예전엔 현재값에서 역산한 가짜 증감률·추세선(mockTrend)을 붙였다. 시연 데이터가 진짜처럼 보일수록
// 오해가 커져 뺐다. 기간별 집계 API가 생기면 그때 추세를 다시 붙인다(지점별 월 실적은 지점 상세, log/129).
function KpiTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="kpi-panel">
      <div className="kpi-panel-top">
        <span className="icon-chip">{icon}</span>
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-panel-bottom">
        <div className="kpi-value">{value}</div>
      </div>
    </div>
  );
}

// 계약 갱신 임박 — 추세가 아니라 "지금 리스크가 몇 건인가"를 보는 지표라 스파크라인 대신
// 값이 있을 때만 경고 톤으로 강조한다(architecture/entities.md §2-1: 본사 대시보드 "갱신 임박 지점" 알림 카드).
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

// 지점이 여럿(SUPER_ADMIN)일 때 쓰는 검색/필터 가능한 지역별 그룹 테이블 — 83개 지점 규모에서도
// 스캔 가능하도록, 지역(서울/경기/인천)으로 접어두고 지역 안에서는 위험도(만료>갱신임박>정상>종료)
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
      // D68 — "갱신임박" 필터(위 알림 카드)는 정상이지만 종료 60일 이내인 지점도 함께 보인다.
      .filter(
        (b) =>
          statusFilter === 'ALL' ||
          b.contractStatus === statusFilter ||
          (statusFilter === 'RENEWAL_DUE' && b.renewalNotice),
      )
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
          // log/125 F7 — 지점이 적으면(시연 5곳) 접혀 있을 이유가 없다. 83곳처럼 많으면 지역별로 접어 둔다.
          defaultExpanded={filtering || branches.length <= AUTO_EXPAND_MAX_BRANCHES}
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
                  <td>
                    {b.contractEndAt ?? '-'}
                    {/* D68 결정 4 — 정상인데 종료 60일 이내. 상태는 바꾸지 않고 표시만 한다. */}
                    {b.renewalNotice && (
                      <span className="badge RENEWAL_DUE" style={{ marginLeft: 6 }}>
                        {b.contractDaysLeft}일 남음
                      </span>
                    )}
                  </td>
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
  const can = useCan();
  const { data, isLoading } = useApiList<BranchSummary>(['branches'], '/branches');
  const [statusFilter, setStatusFilter] = useState<BranchContractStatus | 'ALL'>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  // D75 — 운영 실적: 본사는 전사 합계 + 지난달 지점 비교, 지점 관리자는 자기 지점(지난 12개월 + 이번 달).
  const companyQuery = useQuery<CompanyPerformance>({
    queryKey: ['company-performance'],
    queryFn: async () => (await api.get<ApiEnvelope<CompanyPerformance>>('/branches/performance?months=13')).data.data!,
    enabled: isSuperAdmin,
  });
  const ownBranchId = user?.role === 'BRANCH_ADMIN' ? user.branchId : undefined;
  const ownQuery = useApiList<MonthlyPerformance>(
    ['branch-performance', ownBranchId, 13],
    `/branches/${ownBranchId}/performance?months=13`,
    !!ownBranchId && can('branch', 'READ'),
  );
  const performanceRows = isSuperAdmin ? companyQuery.data?.trend : ownQuery.data;
  const regions = [...new Set((data ?? []).map((b) => b.region))].sort((a, b) => a.localeCompare(b, 'ko'));

  const showTable = (data?.length ?? 0) > 1;
  const branchCount = data?.length ?? 0;
  const totals = data?.reduce(
    (acc, b) => ({
      memberCount: acc.memberCount + b.memberCount,
      staffCount: acc.staffCount + b.staffCount,
      runningProgramCount: acc.runningProgramCount + b.runningProgramCount,
      // D68 결정 4 — 갱신 임박 상태 + 정상인데 종료 60일 이내(조회 때 계산)
      renewalDueCount: acc.renewalDueCount + (b.contractStatus === 'RENEWAL_DUE' || b.renewalNotice ? 1 : 0),
    }),
    { memberCount: 0, staffCount: 0, runningProgramCount: 0, renewalDueCount: 0 },
  );

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2>대시보드</h2>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            {isSuperAdmin
              ? '전체 지점 현황입니다. 지역별로 묶어서 보여줍니다 — 검색·필터하거나 행을 눌러 소속 직원·회원·프로그램·혼잡도를 확인하세요. (D2: SUPER_ADMIN만 모든 지점을 넘나들 수 있습니다)'
              : `${user?.branchName ?? '소속 지점'} 현황입니다. 지점 카드를 눌러 소속 직원·회원·프로그램·혼잡도를 확인하세요.`}
          </p>
        </div>
        {/* D68 결정 5 — 새 위탁계약 = 새 지점(본사 전용) */}
        {isSuperAdmin && (
          <button className="btn-secondary primary" style={{ flexShrink: 0 }} onClick={() => setShowCreate(true)}>
            + 지점 등록
          </button>
        )}
      </div>
      {showCreate && <BranchCreateModal regions={regions} onClose={() => setShowCreate(false)} />}

      {/* D61 — 로그인하면 할 일이 먼저 보인다 */}
      <WorkInbox />

      {isLoading && <div className="loading-state">불러오는 중...</div>}

      {showTable && totals && (
        <div className="kpi-grid">
          <KpiTile icon={<BuildingIcon />} label="전체 지점 수" value={`${branchCount}개`} />
          <KpiTile icon={<BriefcaseIcon />} label="전체 직원 수" value={`${totals.staffCount}명`} />
          <AlertKpiTile
            label="계약 갱신 임박 지점"
            value={`${totals.renewalDueCount}개`}
            alarmed={totals.renewalDueCount > 0}
            onClick={() => setStatusFilter('RENEWAL_DUE')}
          />
        </div>
      )}

      {/* D75 — 지난달(끝난 달) 운영 실적과 전달 대비, 12개월 추세선 */}
      {performanceRows && <PerformanceStatTiles rows={performanceRows} />}

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

      {/* D75 — 월별 추이(차트 4장 + 표로 보기). 본사는 지난달 지점별 순매출 비교도 */}
      {performanceRows && (
        <section className="detail-section" style={{ marginTop: 22 }}>
          <h3 className="section-title">{isSuperAdmin ? '전사 운영 실적' : '우리 지점 운영 실적'} (지난 12개월 + 이번 달)</h3>
          <PerformanceCharts
            rows={performanceRows}
            note="순매출은 회차 예약 결제의 그달 승인액에서 그달 환불액을 뺀 값입니다(수강·PT 패키지 판매는 빠집니다). 이번 달은 오늘까지라 옅게 그립니다."
          />
          {isSuperAdmin && companyQuery.data && companyQuery.data.byBranch.rows.length > 1 && (
            <div style={{ marginTop: 14 }}>
              <RankedBarChart
                title={`지점별 순매출 · ${monthLabel(companyQuery.data.byBranch.month, true)}`}
                unit="원"
                rows={companyQuery.data.byBranch.rows.map((r) => ({
                  key: r.branchId,
                  label: r.branchName,
                  value: r.revenue,
                  note: CONTRACT_STATUS_LABEL[r.contractStatus],
                }))}
              />
            </div>
          )}
        </section>
      )}
      {(companyQuery.isError || ownQuery.isError) && (
        <div className="forbidden-note">{apiErrorMessage((companyQuery.error ?? ownQuery.error) as never)}</div>
      )}
    </>
  );
}
