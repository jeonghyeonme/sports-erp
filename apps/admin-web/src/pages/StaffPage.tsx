import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { apiErrorMessage } from '../lib/use-api-list';
import { ApiEnvelope, StaffRow } from '../lib/types';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

export function StaffPage() {
  const { user } = useAuth();
  const isSelfServiceOnly = user?.role === 'STAFF';

  // 02문서 §7 — STAFF는 목록(/staff) 대신 본인 레코드(/staff/me)만 조회 가능하므로
  // 응답 모양(단일 객체 vs 배열)이 갈려 두 쿼리를 분리해서 처리한다.
  const listQuery = useQuery<StaffRow[], AxiosError<ApiErrorBody>>({
    queryKey: ['staff', 'list'],
    queryFn: async () => (await api.get<ApiEnvelope<StaffRow[]>>('/staff')).data.data ?? [],
    enabled: !isSelfServiceOnly,
  });

  const meQuery = useQuery<StaffRow | undefined, AxiosError<ApiErrorBody>>({
    queryKey: ['staff', 'me'],
    queryFn: async () => (await api.get<ApiEnvelope<StaffRow>>('/staff/me')).data.data,
    enabled: isSelfServiceOnly,
  });

  const isLoading = isSelfServiceOnly ? meQuery.isLoading : listQuery.isLoading;
  const isError = isSelfServiceOnly ? meQuery.isError : listQuery.isError;
  const error = isSelfServiceOnly ? meQuery.error : listQuery.error;
  const rows: StaffRow[] = isSelfServiceOnly
    ? meQuery.data
      ? [meQuery.data]
      : []
    : listQuery.data ?? [];

  return (
    <>
      <h2>직원</h2>
      <p className="page-desc">
        {isSelfServiceOnly
          ? '02문서 §7 — STAFF는 본인 레코드만 조회할 수 있습니다(동료 직원 정보는 노출되지 않습니다).'
          : '02문서 기준 더미 데이터입니다. 지점 관리자는 본인 지점 직원만 조회됩니다.'}
      </p>

      {isError && <div className="forbidden-note">{apiErrorMessage(error ?? null)}</div>}
      {isLoading && <div className="loading-state">불러오는 중...</div>}

      {!isError && rows.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>직원코드</th>
              <th>이름</th>
              <th>직급</th>
              <th>고용형태</th>
              <th>입사일</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.staffCode}</td>
                <td>{s.name}</td>
                <td>{s.position ?? '-'}</td>
                <td>{s.employmentType ?? '-'}</td>
                <td>{s.hireDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
