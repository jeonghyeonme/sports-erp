import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ApiError, apiErrorMessage } from '../lib/use-api-list';
import { useAuth } from '../lib/use-auth';
import { ApiEnvelope, RenewalReport, RenewalTotals } from '../lib/types';
import { CONTRACT_STATUS_LABEL } from '../lib/contract-status';
import { PerformanceCharts } from '../components/charts/PerformanceCharts';

// D81 — 계약 갱신용 영업 리포트(본사 전용). 갱신 협상에 들고 갈 한 장: 계약 회차 → 운영 성과(전사 평균 대비) → 서비스 품질.
// 숫자는 모두 API가 기존 기록에서 계산한다(새로 쌓는 데이터 없음). "인쇄"는 브라우저 인쇄 — 메뉴·상단 바는 인쇄에서 빠진다.
const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const count = (n: number) => n.toLocaleString('ko-KR');

/** 앞 기간 대비 증감(%) — 앞 기간이 0이면 비교하지 않는다. */
function change(now: number, before: number): string {
  if (before === 0) return now === 0 ? '변화 없음' : '앞 기간 기록 없음';
  const pct = Math.round(((now - before) / before) * 1000) / 10;
  return pct === 0 ? '변화 없음' : `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%`;
}

const METRICS: Array<{ key: keyof RenewalTotals; label: string; format: (n: number) => string }> = [
  { key: 'revenue', label: '회차 결제 순매출', format: won },
  { key: 'reservations', label: '예약', format: count },
  { key: 'completed', label: '이용 완료', format: count },
  { key: 'newMembers', label: '신규 회원', format: count },
];

export function RenewalReportPage() {
  const { branchId = '' } = useParams();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const query = useQuery<RenewalReport, ApiError>({
    queryKey: ['renewal-report', branchId],
    enabled: isSuperAdmin,
    queryFn: async () => (await api.get<ApiEnvelope<RenewalReport>>(`/branches/${branchId}/renewal-report`)).data.data!,
  });

  if (!isSuperAdmin) {
    return <div className="forbidden-note">계약 갱신 리포트는 본사 관리자만 볼 수 있습니다.</div>;
  }
  if (query.isError) return <div className="forbidden-note">{apiErrorMessage(query.error)}</div>;
  if (query.isLoading || !query.data) return <div className="loading-state">불러오는 중...</div>;

  const r = query.data;
  const { current } = r.contract;
  const p = r.performance;
  const q = r.quality;

  return (
    <div className="renewal-report">
      <div className="page-header renewal-report-head">
        <div>
          <h2>{r.branch.name} 계약 갱신 리포트</h2>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            {current.partner} · {current.roundNo}회차 {current.startAt} ~ {current.endAt} · 기준일 {r.generatedAt}
          </p>
        </div>
        <div className="action-row no-print">
          <Link className="btn-secondary" style={{ textDecoration: 'none' }} to={`/branches/${branchId}`}>
            지점 상세로
          </Link>
          <button type="button" className="btn-secondary primary" onClick={() => window.print()}>
            인쇄 · PDF 저장
          </button>
        </div>
      </div>

      <section className="detail-section">
        <h3 className="section-title">1. 계약 개요</h3>
        <div className="card-grid">
          <div className="card">
            <div className="stat-row"><span>계약 상태</span><span className={`badge ${r.branch.contractStatus}`}>{CONTRACT_STATUS_LABEL[r.branch.contractStatus as keyof typeof CONTRACT_STATUS_LABEL]}</span></div>
            <div className="stat-row"><span>남은 기간</span><strong>{current.daysLeft >= 0 ? `${current.daysLeft}일` : `${-current.daysLeft}일 지남`}</strong></div>
            <div className="stat-row"><span>운영 기간</span><strong>{r.contract.firstStartAt}부터 {count(r.contract.servedDays)}일</strong></div>
            <div className="stat-row" style={{ marginBottom: 0 }}><span>갱신 횟수</span><strong>{r.contract.renewals}회</strong></div>
          </div>
        </div>
        <table>
          <thead>
            <tr><th>회차</th><th>계약 상대방</th><th>기간</th><th>해지 확정</th></tr>
          </thead>
          <tbody>
            {[...r.contract.rounds].reverse().map((x) => (
              <tr key={x.roundNo}>
                <td>{x.roundNo}회차</td>
                <td>{x.partner}</td>
                <td>{x.startAt} ~ {x.endAt}</td>
                <td>{x.terminatedAt ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="detail-section">
        <h3 className="section-title">2. 운영 성과</h3>
        <p className="page-desc">
          지난 12개월(다 끝난 달) 합계와 최근 6개월의 직전 6개월 대비 증감, 전사 지점 평균(지점 {p.branchCount}곳) 대비입니다.
          이용 완료율(이용 완료 ÷ 예약) {p.completionRate === null ? '— 예약 없음' : `${p.completionRate}%`}.
        </p>
        <table className="renewal-metrics">
          <thead>
            <tr><th>지표</th><th>지난 12개월</th><th>최근 6개월 증감</th><th>전사 지점 평균(12개월)</th><th>평균 대비</th></tr>
          </thead>
          <tbody>
            {METRICS.map((m) => (
              <tr key={m.key}>
                <td>{m.label}</td>
                <td><strong>{m.format(p.last12[m.key])}</strong></td>
                <td>{change(p.recent6[m.key], p.prior6[m.key])}</td>
                <td>{m.format(p.companyAverage12[m.key])}</td>
                <td>{change(p.last12[m.key], p.companyAverage12[m.key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <PerformanceCharts
          rows={p.months}
          note="순매출은 회차 예약 결제의 그달 승인액에서 그달 환불액을 뺀 값입니다(수강·PT 패키지 판매는 빠집니다). 이번 달은 오늘까지라 옅게 그립니다."
        />
      </section>

      <section className="detail-section">
        <h3 className="section-title">3. 서비스 품질·운영 안정성</h3>
        <div className="card-grid">
          <div className="card">
            <div className="stat-row"><span>활성 회원</span><strong>{count(q.members.active)}명</strong></div>
            <div className="stat-row"><span>휴면 · 탈퇴</span><strong>{count(q.members.dormant)} · {count(q.members.withdrawn)}명</strong></div>
            <div className="stat-row"><span>진행 중 프로그램</span><strong>{q.programs.running}개({q.programs.categories}개 종목)</strong></div>
            <div className="stat-row" style={{ marginBottom: 0 }}>
              <span>운영 중 시설 · 평균 혼잡도(90일)</span>
              <strong>{q.facilities.active}곳 · {q.facilities.averageLevel90d === null ? '기록 없음' : `${q.facilities.averageLevel90d}단계`}</strong>
            </div>
          </div>
          <div className="card">
            <div className="stat-row"><span>업무지원 요청(12개월)</span><strong>{q.support.total}건</strong></div>
            <div className="stat-row"><span>완료 · 반려 · 진행 중</span><strong>{q.support.done} · {q.support.rejected} · {q.support.open}건</strong></div>
            <div className="stat-row"><span>평균 처리 기간</span><strong>{q.support.averageResolveDays === null ? '-' : `${q.support.averageResolveDays}일`}</strong></div>
            <div className="stat-row" style={{ marginBottom: 0 }}>
              <span>파견 인력(지금 · 12개월 전입 · 전출)</span>
              <strong>{q.staff.current} · {q.staff.arrived12} · {q.staff.left12}명</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
