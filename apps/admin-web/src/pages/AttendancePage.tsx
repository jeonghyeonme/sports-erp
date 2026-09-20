import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { useAuth } from '../lib/use-auth';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import {
  ApiEnvelope,
  AttendanceRecordRow,
  AttendanceSummaryRow,
  LeaveBalanceRow,
  LeaveRequestRow,
  LeaveType,
  WorkLogRow,
} from '../lib/types';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  ANNUAL: '연차',
  SICK: '병가',
  FAMILY_EVENT: '경조사',
  OTHER: '기타',
};

const STATUS_LABEL: Record<AttendanceRecordRow['status'], string> = {
  NORMAL: '정상',
  LATE: '지각',
  EARLY_LEAVE: '조퇴',
  ABSENT: '결근',
  ON_LEAVE: '휴가',
};

const REQUEST_STATUS_LABEL: Record<LeaveRequestRow['status'], string> = {
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '반려',
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(iso?: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export function AttendancePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'BRANCH_ADMIN';
  const staffId = user?.staffId;
  const month = useMemo(() => todayStr().slice(0, 7), []);

  const [leaveForm, setLeaveForm] = useState({ type: 'ANNUAL' as LeaveType, startDate: todayStr(), endDate: todayStr(), reason: '' });
  const [workLogForm, setWorkLogForm] = useState({ date: todayStr(), content: '' });

  // 03문서 §5 GET /attendance — staffId 생략 시 API가 본인 기준으로 응답한다.
  const myAttendance = useApiList<AttendanceRecordRow>(['attendance', 'mine', month], `/attendance?month=${month}`);
  const todayRecord = myAttendance.data?.find((r) => r.date === todayStr());

  const balanceQuery = useQuery<LeaveBalanceRow | undefined, AxiosError<ApiErrorBody>>({
    queryKey: ['leave-balance', staffId],
    queryFn: async () => (await api.get<ApiEnvelope<LeaveBalanceRow>>(`/leave-balance/${staffId}`)).data.data,
    enabled: !!staffId,
  });

  const myLeaveRequests = useApiList<LeaveRequestRow>(
    ['leave-requests', 'mine', staffId],
    `/leave-requests?staffId=${staffId}`,
  );

  const myWorkLogs = useApiList<WorkLogRow>(['work-logs', 'mine', staffId], `/work-logs?staffId=${staffId}`);

  // 관리 영역 — BRANCH_ADMIN만 조회(03문서 §7 "본인 지점 조회 + 휴가 승인").
  const summaryQuery = useApiList<AttendanceSummaryRow>(['attendance-summary', month], `/attendance/summary?month=${month}`);
  const pendingLeaveQuery = useApiList<LeaveRequestRow>(['leave-requests', 'pending'], '/leave-requests?status=PENDING');

  const invalidateAttendance = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
  };
  const invalidateLeave = () => {
    queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
    queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
  };

  const checkInMutation = useMutation<AttendanceRecordRow, AxiosError<ApiErrorBody>>({
    mutationFn: async () => (await api.post<ApiEnvelope<AttendanceRecordRow>>('/attendance/check-in')).data.data!,
    onSuccess: invalidateAttendance,
  });

  const checkOutMutation = useMutation<AttendanceRecordRow, AxiosError<ApiErrorBody>>({
    mutationFn: async () => (await api.post<ApiEnvelope<AttendanceRecordRow>>('/attendance/check-out')).data.data!,
    onSuccess: invalidateAttendance,
  });

  const requestLeaveMutation = useMutation<LeaveRequestRow, AxiosError<ApiErrorBody>, typeof leaveForm>({
    mutationFn: async (dto) => (await api.post<ApiEnvelope<LeaveRequestRow>>('/leave-requests', dto)).data.data!,
    onSuccess: () => {
      invalidateLeave();
      setLeaveForm((f) => ({ ...f, reason: '' }));
    },
  });

  const reviewLeaveMutation = useMutation<
    LeaveRequestRow,
    AxiosError<ApiErrorBody>,
    { id: string; action: 'approve' | 'reject' }
  >({
    mutationFn: async ({ id, action }) =>
      (await api.patch<ApiEnvelope<LeaveRequestRow>>(`/leave-requests/${id}/${action}`)).data.data!,
    onSuccess: invalidateLeave,
  });

  const workLogMutation = useMutation<WorkLogRow, AxiosError<ApiErrorBody>, typeof workLogForm>({
    mutationFn: async (dto) => (await api.post<ApiEnvelope<WorkLogRow>>('/work-logs', dto)).data.data!,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-logs'] });
      setWorkLogForm({ date: todayStr(), content: '' });
    },
  });

  function submitLeaveRequest(e: FormEvent) {
    e.preventDefault();
    requestLeaveMutation.mutate(leaveForm);
  }

  function submitWorkLog(e: FormEvent) {
    e.preventDefault();
    if (!workLogForm.content.trim()) return;
    workLogMutation.mutate(workLogForm);
  }

  return (
    <>
      <div className="page-header">
        <h2>근태관리</h2>
        <p className="page-desc">
          03문서 기준 — 체크인/아웃, 휴가 신청·승인, 업무일지를 본인 레코드 기준으로 셀프서비스합니다.
          {isAdmin && ' 지점 관리자는 아래에서 지점 전체 근태 요약과 휴가 승인함도 함께 볼 수 있습니다.'}
        </p>
      </div>

      <div className="card-grid">
        <div className="card">
          <h3>오늘의 근태</h3>
          <div className="stat-row">
            <span>체크인</span>
            <strong>{formatTime(todayRecord?.checkInAt)}</strong>
          </div>
          <div className="stat-row">
            <span>체크아웃</span>
            <strong>{formatTime(todayRecord?.checkOutAt)}</strong>
          </div>
          {todayRecord && (
            <div className="stat-row">
              <span>상태</span>
              <span className={`badge ${todayRecord.status}`}>{STATUS_LABEL[todayRecord.status]}</span>
            </div>
          )}
          {(checkInMutation.isError || checkOutMutation.isError) && (
            <div className="forbidden-note">
              {apiErrorMessage(checkInMutation.error ?? checkOutMutation.error ?? null)}
            </div>
          )}
          <div className="action-row" style={{ marginTop: 10 }}>
            <button
              className="btn-secondary"
              disabled={!!todayRecord?.checkInAt || checkInMutation.isPending}
              onClick={() => checkInMutation.mutate()}
            >
              체크인
            </button>
            <button
              className="btn-secondary"
              disabled={!todayRecord?.checkInAt || !!todayRecord?.checkOutAt || checkOutMutation.isPending}
              onClick={() => checkOutMutation.mutate()}
            >
              체크아웃
            </button>
          </div>
        </div>

        <div className="card">
          <h3>연차 잔여일수</h3>
          {balanceQuery.isLoading && <div className="loading-state">불러오는 중...</div>}
          {balanceQuery.data && (
            <>
              <div className="stat-row">
                <span>{balanceQuery.data.year}년 부여일수</span>
                <strong>{balanceQuery.data.totalDays}일</strong>
              </div>
              <div className="stat-row">
                <span>사용일수</span>
                <strong>{balanceQuery.data.usedDays}일</strong>
              </div>
              <div className="stat-row">
                <span>잔여일수</span>
                <strong>{balanceQuery.data.totalDays - balanceQuery.data.usedDays}일</strong>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="detail-section">
        <h3 className="section-title">이번 달 근태 기록</h3>
        {myAttendance.isError && <div className="forbidden-note">{apiErrorMessage(myAttendance.error)}</div>}
        {!myAttendance.isError && (myAttendance.data?.length ?? 0) === 0 && (
          <div className="empty-state">이번 달 기록이 없습니다.</div>
        )}
        {!myAttendance.isError && (myAttendance.data?.length ?? 0) > 0 && (
          <table>
            <thead>
              <tr>
                <th>날짜</th>
                <th>체크인</th>
                <th>체크아웃</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {myAttendance.data!.map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{formatTime(r.checkInAt)}</td>
                  <td>{formatTime(r.checkOutAt)}</td>
                  <td>
                    <span className={`badge ${r.status}`}>{STATUS_LABEL[r.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="detail-section">
        <h3 className="section-title">휴가 신청</h3>
        <form onSubmit={submitLeaveRequest}>
          <div className="form-row">
            <div className="field">
              <label>유형</label>
              <select
                value={leaveForm.type}
                onChange={(e) => setLeaveForm((f) => ({ ...f, type: e.target.value as LeaveType }))}
              >
                {(Object.keys(LEAVE_TYPE_LABEL) as LeaveType[]).map((t) => (
                  <option key={t} value={t}>
                    {LEAVE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>시작일</label>
              <input
                type="date"
                value={leaveForm.startDate}
                onChange={(e) => setLeaveForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>종료일</label>
              <input
                type="date"
                value={leaveForm.endDate}
                onChange={(e) => setLeaveForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="field">
            <label>사유(선택)</label>
            <input
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="개인 사유 등"
            />
          </div>
          {requestLeaveMutation.isError && (
            <div className="forbidden-note">{apiErrorMessage(requestLeaveMutation.error)}</div>
          )}
          {requestLeaveMutation.data && requestLeaveMutation.isSuccess && (
            <div className="stat-row" style={{ marginBottom: 10 }}>
              신청 완료 — {requestLeaveMutation.data.days}일
            </div>
          )}
          <button className="btn-secondary" type="submit" disabled={requestLeaveMutation.isPending}>
            휴가 신청
          </button>
        </form>

        <h3 className="section-title" style={{ marginTop: 20 }}>
          내 휴가 신청 내역
        </h3>
        {(myLeaveRequests.data?.length ?? 0) === 0 ? (
          <div className="empty-state">신청 내역이 없습니다.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>유형</th>
                <th>기간</th>
                <th>일수</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {myLeaveRequests.data!.map((r) => (
                <tr key={r.id}>
                  <td>{LEAVE_TYPE_LABEL[r.type]}</td>
                  <td>
                    {r.startDate} ~ {r.endDate}
                  </td>
                  <td>{r.days}일</td>
                  <td>
                    <span className={`badge ${r.status}`}>{REQUEST_STATUS_LABEL[r.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="detail-section">
        <h3 className="section-title">업무일지</h3>
        <form onSubmit={submitWorkLog}>
          <div className="form-row">
            <div className="field" style={{ maxWidth: 160 }}>
              <label>날짜</label>
              <input
                type="date"
                value={workLogForm.date}
                onChange={(e) => setWorkLogForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
          </div>
          <div className="field">
            <label>내용</label>
            <textarea
              rows={3}
              value={workLogForm.content}
              onChange={(e) => setWorkLogForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="오늘 진행한 업무를 기록하세요"
            />
          </div>
          {workLogMutation.isError && <div className="forbidden-note">{apiErrorMessage(workLogMutation.error)}</div>}
          <button className="btn-secondary" type="submit" disabled={workLogMutation.isPending}>
            저장
          </button>
        </form>

        {(myWorkLogs.data?.length ?? 0) > 0 && (
          <table style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>날짜</th>
                <th>내용</th>
              </tr>
            </thead>
            <tbody>
              {myWorkLogs.data!.map((l) => (
                <tr key={l.id}>
                  <td>{l.date}</td>
                  <td>{l.content}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isAdmin && (
        <>
          <div className="detail-section">
            <h3 className="section-title">지점 근태 요약(이번 달)</h3>
            {(summaryQuery.data?.length ?? 0) === 0 ? (
              <div className="empty-state">표시할 데이터가 없습니다.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>정상</th>
                    <th>지각</th>
                    <th>결근</th>
                    <th>조퇴</th>
                    <th>휴가</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryQuery.data!.map((s) => (
                    <tr key={s.staffId}>
                      <td>{s.name}</td>
                      <td>{s.normal}</td>
                      <td>{s.late}</td>
                      <td>{s.absent}</td>
                      <td>{s.earlyLeave}</td>
                      <td>{s.onLeave}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="detail-section">
            <h3 className="section-title">휴가 승인함</h3>
            {reviewLeaveMutation.isError && (
              <div className="forbidden-note">{apiErrorMessage(reviewLeaveMutation.error)}</div>
            )}
            {(pendingLeaveQuery.data?.length ?? 0) === 0 ? (
              <div className="empty-state">대기 중인 휴가 신청이 없습니다.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>유형</th>
                    <th>기간</th>
                    <th>일수</th>
                    <th>사유</th>
                    <th>처리</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingLeaveQuery.data!.map((r) => (
                    <tr key={r.id}>
                      <td>{LEAVE_TYPE_LABEL[r.type]}</td>
                      <td>
                        {r.startDate} ~ {r.endDate}
                      </td>
                      <td>{r.days}일</td>
                      <td>{r.reason ?? '-'}</td>
                      <td>
                        <div className="action-row">
                          <button
                            className="btn-secondary"
                            disabled={reviewLeaveMutation.isPending}
                            onClick={() => reviewLeaveMutation.mutate({ id: r.id, action: 'approve' })}
                          >
                            승인
                          </button>
                          <button
                            className="btn-danger-outline"
                            disabled={reviewLeaveMutation.isPending}
                            onClick={() => reviewLeaveMutation.mutate({ id: r.id, action: 'reject' })}
                          >
                            반려
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}
