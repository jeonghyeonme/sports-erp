import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { MemberRow } from '../lib/types';

export function MembersPage() {
  const { data, isLoading, isError, error } = useApiList<MemberRow>(['members'], '/members');

  return (
    <>
      <h2>회원</h2>
      <p className="page-desc">
        05문서 기준 더미 데이터입니다. BRANCH_ADMIN은 본인 지점 회원만, STAFF는 접근 시 403이 표시됩니다.
      </p>

      {isError && <div className="forbidden-note">{apiErrorMessage(error)}</div>}
      {isLoading && <div className="loading-state">불러오는 중...</div>}
      {!isLoading && !isError && data && data.length === 0 && (
        <div className="empty-state">표시할 회원이 없습니다.</div>
      )}

      {!isError && data && data.length > 0 && (
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
            {data.map((m) => (
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
      )}
    </>
  );
}
