import { ReactNode, useEffect, useState } from 'react';

interface Props {
  branchName: string;
  count: number;
  countLabel: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}

// BranchDetailPage의 직원 아코디언(staff-row/chevron)과 같은 상호작용을, 지점 횡단 목록
// 페이지(회원/직원/프로그램/시설)에서 재사용하기 위한 일반화 버전. 지점이 많아질수록(최대 98개)
// 기본 접힘 상태가 "지점 인덱스"처럼 스캔 가능하게 동작한다.
export function CollapsibleBranchSection({ branchName, count, countLabel, defaultExpanded = false, children }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // 검색어로 좁혀져서 부모가 defaultExpanded를 바꾸면(예: 결과 3개 이하) 그에 맞춰 갱신
  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  return (
    <div className="staff-block">
      <button className="staff-row" onClick={() => setExpanded((v) => !v)}>
        <div className="staff-row-body">
          <div className="staff-row-name">{branchName}</div>
        </div>
        <span className="section-count">
          {count}
          {countLabel}
        </span>
        <span className="chevron">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && <div className="nested-table-wrap">{children}</div>}
    </div>
  );
}
