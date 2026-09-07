import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { BranchSummary, MemberRow, ProgramRow, StaffRow } from '../lib/types';
import { BriefcaseIcon } from '../components/icons';

const PRICING_LABEL: Record<ProgramRow['pricingType'], string> = {
  FREE_ACCESS: '자유이용',
  PAID_SESSION: '회차 예약',
  PT_PACKAGE: 'PT 패키지',
};

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

  const branchesQuery = useApiList<BranchSummary>(['branches'], '/branches');
  const staffQuery = useApiList<StaffRow>(['staff', branchId], `/staff?branchId=${branchId}`);
  const membersQuery = useApiList<MemberRow>(['members', branchId], `/members?branchId=${branchId}`);
  const programsQuery = useApiList<ProgramRow>(['programs', branchId], `/programs?branchId=${branchId}`);

  const branchName = branchesQuery.data?.find((b) => b.id === branchId)?.name ?? branchId;
  const members = membersQuery.data ?? [];
  const staff = staffQuery.data ?? [];
  const programs = programsQuery.data ?? [];
  const unassignedMembers = members.filter((m) => !m.assignedStaffId);

  return (
    <>
      <div className="page-header">
        <Link className="back-link" to="/">
          ← 대시보드로
        </Link>
        <h2>{branchName}</h2>
        <p className="page-desc">
          지점 → 직원 → 회원, 지점 → 프로그램 순서로 소속 데이터를 확인합니다.
        </p>
      </div>

      <section className="detail-section">
        <h3 className="section-title">
          직원
          <span className="section-count">{staff.length}명</span>
        </h3>

        {staffQuery.isError && <div className="forbidden-note">{apiErrorMessage(staffQuery.error)}</div>}
        {staffQuery.isLoading && <div className="loading-state">불러오는 중...</div>}
        {membersQuery.isError && <div className="forbidden-note">{apiErrorMessage(membersQuery.error)}</div>}

        {!staffQuery.isError && !staffQuery.isLoading && staff.length === 0 && (
          <div className="empty-state">등록된 직원이 없습니다.</div>
        )}

        {!staffQuery.isError && staff.length > 0 && (
          <div className="staff-list">
            {staff.map((s) => {
              const assignedMembers = members.filter((m) => m.assignedStaffId === s.id);
              const expanded = expandedStaffId === s.id;
              return (
                <div className="staff-block" key={s.id}>
                  <button
                    className="staff-row"
                    onClick={() => setExpandedStaffId(expanded ? null : s.id)}
                  >
                    <span className="icon-chip tone-violet">
                      <BriefcaseIcon />
                    </span>
                    <div className="staff-row-body">
                      <div className="staff-row-name">
                        {s.name}
                        <span className="staff-row-position">{s.position ?? '-'}</span>
                      </div>
                      <div className="staff-row-sub">담당 회원 {assignedMembers.length}명</div>
                    </div>
                    <span className="chevron">{expanded ? '▲' : '▼'}</span>
                  </button>
                  {expanded && (
                    <div className="nested-table-wrap">
                      {!membersQuery.isError && <MemberTable rows={assignedMembers} />}
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
          <span className="section-count">{unassignedMembers.length}명</span>
        </h3>
        <p className="page-desc">회원권만 등록하고 담당 트레이너가 배정되지 않은 회원입니다.</p>
        {!membersQuery.isError && !membersQuery.isLoading && <MemberTable rows={unassignedMembers} />}
      </section>

      <section className="detail-section">
        <h3 className="section-title">
          프로그램
          <span className="section-count">{programs.length}개</span>
        </h3>

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
    </>
  );
}
