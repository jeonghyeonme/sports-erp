import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { apiErrorMessage, useApiList } from '../lib/use-api-list';
import { useToast } from '../lib/use-toast';
import { AbsenceCandidateRow, ApiEnvelope, AttendanceRecordRow } from '../lib/types';
import { Modal } from './Modal';

interface ApiErrorBody {
  code?: string;
  message?: string;
}

// 근태관리 ADR-ATT-02 — 결근은 배치가 아니라 지점 관리자의 명시적 확정이다. 미리보기(저장 안 함)를 보고
// 확정하면 그 시점에 다시 계산한 후보만 ABSENT로 저장된다(이미 확정된 날은 건너뛴다 — 여러 번 눌러도 안전).
// 서버가 "오늘 이전"만 후보로 보므로 이번 달은 어제까지만 나온다.
function kstMonth(offset: number): string {
  const now = new Date(Date.now() + 9 * 3_600_000); // KST 기준 연·월
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  return d.toISOString().slice(0, 7);
}

// "09-01~09-05, 09-08" — 이어지는 날은 범위로 묶는다(한 달 내내 빠지면 30개가 늘어서므로).
function compactDates(dates: string[]): string {
  const parts: string[] = [];
  let start = dates[0];
  let prev = dates[0];
  const flush = () => parts.push(start === prev ? start.slice(5) : `${start.slice(5)}~${prev.slice(5)}`);
  for (const d of dates.slice(1)) {
    const next = new Date(`${prev}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    if (next.toISOString().slice(0, 10) === d) {
      prev = d;
      continue;
    }
    flush();
    start = prev = d;
  }
  flush();
  return parts.join(', ');
}

export function AbsenceConfirmSection() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const months = [kstMonth(-1), kstMonth(0)];
  const [month, setMonth] = useState(months[0]);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState('');

  const preview = useApiList<AbsenceCandidateRow>(['absence-preview', month], `/attendance/absence-preview?month=${month}`);
  const rows = preview.data ?? [];
  const byStaff = new Map<string, { name: string; dates: string[] }>();
  for (const r of rows) {
    const entry = byStaff.get(r.staffId) ?? { name: r.name, dates: [] };
    entry.dates.push(r.date);
    byStaff.set(r.staffId, entry);
  }

  const confirmMutation = useMutation<AttendanceRecordRow[], AxiosError<ApiErrorBody>>({
    mutationFn: async () =>
      (
        await api.post<ApiEnvelope<AttendanceRecordRow[]>>('/attendance/absence-confirm', {
          month,
          note: note.trim() || undefined,
        })
      ).data.data ?? [],
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['absence-preview'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success(created.length > 0 ? `결근 ${created.length}건을 확정했습니다.` : '새로 확정할 결근이 없습니다.');
      setConfirming(false);
      setNote('');
    },
  });

  return (
    <div className="detail-section">
      <h3 className="section-title">결근 확정</h3>
      <p className="page-desc">
        근무일인데 출근 기록도 승인된 휴가도 없는 날을 보여 줍니다(아직 저장 전). 대기 중인 휴가 신청을 먼저 처리하고, 확인한 뒤 "확정"하면 결근으로 기록됩니다.
      </p>
      <div className="list-toolbar" style={{ gap: 8 }}>
        {months.map((m, i) => (
          <button key={m} className={month === m ? 'filter-chip active' : 'filter-chip'} onClick={() => setMonth(m)}>
            {m} {i === 0 ? '(지난달)' : '(이번 달, 어제까지)'}
          </button>
        ))}
      </div>

      {preview.isError && <div className="forbidden-note">{apiErrorMessage(preview.error)}</div>}
      {preview.isLoading && <div className="loading-state">불러오는 중...</div>}
      {!preview.isLoading && !preview.isError && rows.length === 0 && (
        <div className="empty-state">확정할 결근이 없습니다.</div>
      )}
      {!preview.isError && rows.length > 0 && (
        <>
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>일수</th>
                <th>날짜</th>
              </tr>
            </thead>
            <tbody>
              {[...byStaff.entries()].map(([staffId, s]) => (
                <tr key={staffId}>
                  <td>{s.name}</td>
                  <td>{s.dates.length}일</td>
                  <td>{compactDates(s.dates)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="action-row" style={{ marginTop: 10 }}>
            <button className="btn-danger-outline" onClick={() => setConfirming(true)}>
              결근 {rows.length}건 확정
            </button>
          </div>
        </>
      )}

      {confirming && (
        <Modal title={`${month} 결근 확정`} onClose={() => setConfirming(false)}>
          <p style={{ marginTop: 0 }}>
            직원 {byStaff.size}명, 결근 {rows.length}건을 기록합니다. 확정한 결근은 이 화면에서 되돌릴 수 없습니다(근태 정정
            기능 없음). 출근했는데 기록이 빠진 날이 있으면 먼저 확인하세요.
          </p>
          <div className="field">
            <label>메모(선택)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 9월 근태 마감" />
          </div>
          {confirmMutation.isError && (
            <div className="forbidden-note" style={{ marginTop: 12 }}>
              {apiErrorMessage(confirmMutation.error)}
            </div>
          )}
          <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
            <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
              취소
            </button>
            <button
              type="button"
              className="btn-danger-outline"
              disabled={confirmMutation.isPending}
              onClick={() => confirmMutation.mutate()}
            >
              확정
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
