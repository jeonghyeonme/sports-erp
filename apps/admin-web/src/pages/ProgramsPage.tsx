import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { ProgramRow } from '../lib/types';

const PRICING_LABEL: Record<ProgramRow['pricingType'], string> = {
  FREE_ACCESS: '자유이용',
  PAID_SESSION: '회차 예약',
  PT_PACKAGE: 'PT 패키지',
};

export function ProgramsPage() {
  const { data, isLoading, isError, error } = useApiList<ProgramRow>(['programs'], '/programs');

  return (
    <>
      <h2>프로그램</h2>
      <p className="page-desc">
        07문서 기준 더미 데이터입니다. status(D7)와 pricingType(D8)이 실제로 구분되어 내려옵니다.
      </p>

      {isError && <div className="forbidden-note">{apiErrorMessage(error)}</div>}
      {isLoading && <div className="loading-state">불러오는 중...</div>}

      {!isError && data && data.length > 0 && (
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
            {data.map((p) => (
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
    </>
  );
}
