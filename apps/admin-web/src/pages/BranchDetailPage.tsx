import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { apiErrorMessage, useApiList, useApiPage } from '../lib/use-api-list';
import { Pager } from '../components/Pager';
import {
  ApiEnvelope,
  AssetRow,
  BranchSummary,
  FacilityRow,
  MemberRow,
  ProgramRow,
  ProgramStatus,
  ProgramStatusSummary,
  StaffRow,
} from '../lib/types';
import { BriefcaseIcon } from '../components/icons';
import { CONTRACT_STATUS_LABEL, contractRemainingLabel } from '../lib/contract-status';
import { useAuth } from '../lib/use-auth';
import { ContractStatusModal } from '../components/ContractStatusModal';

const PRICING_LABEL: Record<ProgramRow['pricingType'], string> = {
  FREE_ACCESS: '자유이용',
  PAID_SESSION: '회차 예약',
  PT_PACKAGE: 'PT 패키지',
};

const STATUS_LABEL: Record<ProgramStatus, string> = {
  PREPARING: '준비중',
  RUNNING: '진행중',
  PAUSED: '휴강',
  ENDED: '종료',
};

const MEMBER_PAGE_SIZE = 20;

// D43 — 지점 회원 전체를 받아 화면에서 나누지 않고, 직원을 펼칠 때(또는 "담당 없음" 절에서) 그 조건의 쪽만 부른다
// (B8 사용자 결정, assignedStaffId 필터 — 'none'이면 미배정).
function AssignedMembers({ branchId, assignedStaffId }: { branchId: string; assignedStaffId: string }) {
  const [page, setPage] = useState(1);
  const query = useApiPage<MemberRow>(
    ['members', branchId, 'assigned', assignedStaffId, page],
    `/members?branchId=${branchId}&assignedStaffId=${assignedStaffId}&page=${page}&limit=${MEMBER_PAGE_SIZE}`,
  );
  if (query.isLoading) return <div className="loading-state">불러오는 중...</div>;
  if (query.isError) return <div className="forbidden-note">{apiErrorMessage(query.error)}</div>;
  const total = query.data?.total ?? 0;
  return (
    <>
      {total > 0 && (
        <p className="page-desc" style={{ margin: '0 0 8px' }}>
          {total.toLocaleString()}명
        </p>
      )}
      <MemberTable rows={query.data?.rows ?? []} />
      <Pager page={page} pageSize={MEMBER_PAGE_SIZE} total={total} onChange={setPage} disabled={query.isFetching} />
    </>
  );
}

function MemberTable({ rows }: { rows: MemberRow[] }) {
  if (rows.length === 0) {
    return <div className="empty-state">표시할 회원이 없습니다.</div>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>회원번호</th>
          <th>이름</th>
          <th>연락처</th>
          <th>상태</th>
          <th>가입일</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.id}>
            <td>{m.memberNo}</td>
            <td>{m.name}</td>
            <td>{m.phone ?? '-'}</td>
            <td>
              <span className={`badge ${m.status}`}>{m.status}</span>
            </td>
            <td>{m.joinedAt}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BranchDetailPage() {
  const { branchId = '' } = useParams<{ branchId: string }>();
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const { user } = useAuth();
  // ADR-STF-07 — 계약 상태 변경은 본사 전용(서버도 SUPER_ADMIN 외에는 403).
  const canChangeContract = user?.role === 'SUPER_ADMIN';

  const branchesQuery = useApiList<BranchSummary>(['branches'], '/branches');
  const staffQuery = useApiList<StaffRow>(['staff', branchId], `/staff?branchId=${branchId}`);
  const programsQuery = useApiList<ProgramRow>(['programs', branchId], `/programs?branchId=${branchId}`);
  // 강사프로그램게시 A-5 지점 현황판 API — 이미 완성돼 있었지만 화면 어디서도 호출하지 않던 것을 여기서 연결한다.
  const programSummaryQuery = useQuery<ProgramStatusSummary | undefined>({
    queryKey: ['programs-summary', branchId],
    queryFn: async () =>
      (await api.get<ApiEnvelope<ProgramStatusSummary>>(`/branches/${branchId}/programs/summary`)).data.data,
    enabled: !!branchId,
  });
  const facilitiesQuery = useApiList<FacilityRow>(['facilities', branchId], `/facilities?branchId=${branchId}`);
  // ADR-RES-01 — 계약종료 지점의 잔여 자산은 자동 처리하지 않고 경고만 노출한다(자원문서관리 A-6).
  // D43 — 자산 기본 목록은 폐기를 뺀 목록이라 그 total이 곧 미처리 자산 수다(1건만 받아 total만 쓴다).
  const assetsQuery = useApiPage<AssetRow>(['assets', branchId, 'unprocessed'], `/assets?branchId=${branchId}&limit=1`);

  const branch = branchesQuery.data?.find((b) => b.id === branchId);
  const branchName = branch?.name ?? branchId;
  const staff = staffQuery.data ?? [];
  const programs = programsQuery.data ?? [];
  const facilities = facilitiesQuery.data ?? [];
  const unprocessedAssetCount = assetsQuery.data?.total ?? 0;

  return (
    <>
      <div className="page-header">
        <Link className="back-link" to="/">
          ← 대시보드로
        </Link>
        <h2>{branchName}</h2>
        <p className="page-desc">
          지점 → 직원 → 회원, 지점 → 프로그램 → 혼잡도 순서로 소속 데이터를 확인합니다.
        </p>
      </div>

      <section className="detail-section">
        <h3 className="section-title">계약 정보</h3>
        {branch && (
          <div className="card">
            <div className="stat-row">
              <span>계약 상대방</span>
              <strong>{branch.contractPartner ?? '-'}</strong>
            </div>
            <div className="stat-row">
              <span>계약 기간</span>
              <strong>
                {branch.contractStartAt ?? '-'} ~ {branch.contractEndAt ?? '상시'}
              </strong>
            </div>
            <div className="stat-row">
              <span>계약 상태</span>
              <span className={`badge ${branch.contractStatus}`}>
                {CONTRACT_STATUS_LABEL[branch.contractStatus]}
              </span>
            </div>
            <div className="stat-row" style={{ marginBottom: 0 }}>
              <span>잔여</span>
              <strong>{contractRemainingLabel(branch.contractEndAt)}</strong>
            </div>
            {canChangeContract && (
              <div className="action-row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setContractModalOpen(true)}>
                  계약 상태 변경
                </button>
              </div>
            )}
          </div>
        )}
        {contractModalOpen && branch && (
          <ContractStatusModal branch={branch} onClose={() => setContractModalOpen(false)} />
        )}
        {branch?.contractStatus === 'TERMINATED' && unprocessedAssetCount > 0 && (
          <div className="forbidden-note" style={{ marginTop: 8 }}>
            미처리 자산 {unprocessedAssetCount}건 — 위탁계약이 종료됐지만 아직 폐기 처리되지 않은 자산이
            남아 있습니다. 다른 지점으로 이관하거나 폐기 처리해주세요(자동 처리되지 않습니다).
          </div>
        )}
        <p className="page-desc">
          계약서 스캔본을 업로드하면 OCR·AI가 이 필드들을 자동으로 채우는 기능은 설계돼 있습니다(차별화전략 §1-1,
          Phase 2~3 예정) — 지금은 mock 값을 그대로 보여줍니다.
        </p>
      </section>

      <section className="detail-section">
        <h3 className="section-title">
          직원
          <span className="section-count">{staff.length}명</span>
        </h3>

        {staffQuery.isError && <div className="forbidden-note">{apiErrorMessage(staffQuery.error)}</div>}
        {staffQuery.isLoading && <div className="loading-state">불러오는 중...</div>}

        {!staffQuery.isError && !staffQuery.isLoading && staff.length === 0 && (
          <div className="empty-state">등록된 직원이 없습니다.</div>
        )}

        {!staffQuery.isError && staff.length > 0 && (
          <div className="staff-list">
            {staff.map((s) => {
              const expanded = expandedStaffId === s.id;
              return (
                <div className="staff-block" key={s.id}>
                  <button
                    className="staff-row"
                    onClick={() => setExpandedStaffId(expanded ? null : s.id)}
                  >
                    <span className="icon-chip">
                      <BriefcaseIcon />
                    </span>
                    <div className="staff-row-body">
                      <div className="staff-row-name">
                        {s.name}
                        <span className="staff-row-position">{s.position ?? '-'}</span>
                      </div>
                      <div className="staff-row-sub">담당 회원 {expanded ? '' : '보기'}</div>
                    </div>
                    <span className="chevron">{expanded ? '▲' : '▼'}</span>
                  </button>
                  {expanded && (
                    <div className="nested-table-wrap">
                      <AssignedMembers branchId={branchId} assignedStaffId={s.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="detail-section">
        <h3 className="section-title">
          담당 직원 없음
        </h3>
        <p className="page-desc">회원권만 등록하고 담당 트레이너가 배정되지 않은 회원입니다.</p>
        <AssignedMembers branchId={branchId} assignedStaffId="none" />
      </section>

      <section className="detail-section">
        <h3 className="section-title">
          프로그램
          <span className="section-count">{programs.length}개</span>
        </h3>

        {programSummaryQuery.data && (
          <div className="kpi-grid">
            {(['PREPARING', 'RUNNING', 'PAUSED', 'ENDED'] as ProgramStatus[]).map((status) => (
              <div className="kpi-panel" key={status}>
                <div className="kpi-label">{STATUS_LABEL[status]}</div>
                <div className="kpi-value">{programSummaryQuery.data!.byStatus[status] ?? 0}개</div>
              </div>
            ))}
          </div>
        )}

        {programsQuery.isError && <div className="forbidden-note">{apiErrorMessage(programsQuery.error)}</div>}
        {programsQuery.isLoading && <div className="loading-state">불러오는 중...</div>}
        {!programsQuery.isError && !programsQuery.isLoading && programs.length === 0 && (
          <div className="empty-state">등록된 프로그램이 없습니다.</div>
        )}

        {!programsQuery.isError && programs.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>프로그램명</th>
                <th>종목</th>
                <th>이용방식</th>
                <th>가격</th>
                <th>강사</th>
                <th>상태</th>
                <th>시작일</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.category}</td>
                  <td>{PRICING_LABEL[p.pricingType]}</td>
                  <td>{p.price > 0 ? `${p.price.toLocaleString()}원` : '무료'}</td>
                  <td>{p.instructorName ?? '-'}</td>
                  <td>
                    <span className={`badge ${p.status}`}>{p.status}</span>
                  </td>
                  <td>{p.startDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="detail-section">
        <h3 className="section-title">
          혼잡도
          <span className="section-count">{facilities.length}개 시설</span>
        </h3>

        {facilitiesQuery.isError && <div className="forbidden-note">{apiErrorMessage(facilitiesQuery.error)}</div>}
        {facilitiesQuery.isLoading && <div className="loading-state">불러오는 중...</div>}
        {!facilitiesQuery.isError && !facilitiesQuery.isLoading && facilities.length === 0 && (
          <div className="empty-state">등록된 시설이 없습니다.</div>
        )}

        {!facilitiesQuery.isError && facilities.length > 0 && <FacilityCards rows={facilities} />}
      </section>
    </>
  );
}

export function FacilityCards({ rows }: { rows: FacilityRow[] }) {
  return (
    <div className="card-grid">
      {rows.map((f) => (
        <div className="card" key={f.id}>
          <h3>{f.name}</h3>
          <div className="stat-row">
            <span>현재 인원</span>
            <strong>
              {f.currentCount} / {f.capacity}명
            </strong>
          </div>
          <div className="congestion-bar">
            <div
              className="congestion-bar-fill"
              style={{ width: `${Math.min(100, (f.currentCount / f.capacity) * 100)}%` }}
            />
          </div>
          <div className="stat-row" style={{ marginTop: 8 }}>
            <span>혼잡도 단계</span>
            <strong>{f.level} / 5</strong>
          </div>
        </div>
      ))}
    </div>
  );
}
