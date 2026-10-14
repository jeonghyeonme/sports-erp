import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { AbsenceCandidateRow, AttendanceSummaryRow, BranchSummary } from '../lib/types';

// 본사 근태 조회 — RFP 개념도 "본사→현장 근태관리"(요구사항추적표 §2-3, D51·log/114).
// 근태관리 A-7을 "본사는 조회만"으로 좁혔다: 출퇴근·휴가 승인·결근 확정은 지금처럼 지점(관리자·직원)이 하고,
// 본사는 지점을 골라 그 달 요약과 확정 전 결근 후보를 본다. API는 원래 본사 조회를 허용한다(summary·absence-preview).
function kstMonth(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 7);
}

export function HqAttendancePage() {
  const branchesQuery = useApiList<BranchSummary>(['branches'], '/branches');
  const branches = useMemo(
    () => [...(branchesQuery.data ?? [])].sort((a, b) => a.region.localeCompare(b.region) || a.name.localeCompare(b.name)),
    [branchesQuery.data],
  );
  const [picked, setPicked] = useState('');
  const branchId = picked || branches[0]?.id || '';
  const [month, setMonth] = useState(kstMonth);

  const summaryQuery = useApiList<AttendanceSummaryRow>(
    ['attendance-summary', branchId, month],
    `/attendance/summary?branchId=${branchId}&month=${month}`,
    !!branchId,
  );
  const previewQuery = useApiList<AbsenceCandidateRow>(
    ['absence-preview', branchId, month],
    `/attendance/absence-preview?branchId=${branchId}&month=${month}`,
    !!branchId,
  );
  const pendingByStaff = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of previewQuery.data ?? []) m.set(r.staffId, (m.get(r.staffId) ?? 0) + 1);
    return m;
  }, [previewQuery.data]);
  const rows = branchId ? (summaryQuery.data ?? []) : [];

  return (
    <>
      <div className="page-header">
        <h2>근태 현황</h2>
        <p className="page-desc">
          지점을 골라 그 달 근태 요약을 봅니다(조회 전용). 휴가 승인과 결근 확정은 지점 관리자가 합니다.
        </p>
      </div>

      <div className="card">
        <div className="action-row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <label>
            지점{' '}
            <select value={branchId} onChange={(e) => setPicked(e.target.value)}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.region} · {b.name}
                  {b.contractStatus === 'TERMINATED' ? ' (계약 종료)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            월 <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          </label>
        </div>

        {branchesQuery.isError && <div className="forbidden-note">{apiErrorMessage(branchesQuery.error)}</div>}
        {summaryQuery.isError && <div className="forbidden-note">{apiErrorMessage(summaryQuery.error)}</div>}
        {summaryQuery.isLoading && <div className="loading-state">불러오는 중...</div>}
        {summaryQuery.isSuccess && rows.length === 0 && <div className="empty-state">이 달 근태 기록이 없습니다.</div>}
        {rows.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>정상</th>
                <th>지각</th>
                <th>결근</th>
                <th>조퇴</th>
                <th>휴가</th>
                <th title="출근 기록·승인 휴가가 없는 근무일 — 지점 관리자가 확정하기 전">결근 후보(미확정)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.staffId}>
                  <td>
                    <Link to={`/staff/${s.staffId}`}>{s.name}</Link>
                  </td>
                  <td>{s.normal}</td>
                  <td>{s.late}</td>
                  <td>{s.absent}</td>
                  <td>{s.earlyLeave}</td>
                  <td>{s.onLeave}</td>
                  <td>{pendingByStaff.get(s.staffId) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
