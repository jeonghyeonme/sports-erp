import { addYearsToDateString, toKstDateString } from '../../common/date/kst-date';

/**
 * D71 — 계약 파일 보존 계산. 회차가 끝난 날부터 3년 시스템에 두고, 그 6개월 전부터 실물 이관을 알린다.
 * 회차 표·보존 현황·처리 대기함이 같은 함수를 쓴다(서비스 의존이 없어 처리 대기함이 바로 가져다 쓴다).
 */
export const CONTRACT_FILE_RETENTION_YEARS = 3;
export const CONTRACT_ARCHIVE_NOTICE_MONTHS = 6;

/** 회차가 끝난 날(해지로 끝났으면 해지 확정일, 아니면 종료일) + 3년 — 보존 끝(이날까지 시스템에 둔다). */
export function contractFileRetentionUntil(round: { endAt: Date; terminatedAt: Date | null }): string {
  return addYearsToDateString(toKstDateString(round.terminatedAt ?? round.endAt), CONTRACT_FILE_RETENTION_YEARS);
}

/** YYYY-MM-DD에 개월 수를 더한다. 그 달에 없는 날이면 말일로 맞춘다(8/31 + 6개월 = 2/28·29). */
function addMonthsToDateString(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, lastDay));
  return first.toISOString().slice(0, 10);
}

export type RetentionState = { retentionUntil: string; needsArchive: boolean; retentionEnded: boolean };

/** 오늘 기준 보존 상태 — 이관 안 한 파일이 보존 끝 6개월 안(또는 지남)이면 이관 필요, 보존 끝을 지났으면 기간 종료. */
export function retentionState(
  file: { archivedAt: Date | null; purgedAt: Date | null },
  round: { endAt: Date; terminatedAt: Date | null },
  today: string,
): RetentionState {
  const retentionUntil = contractFileRetentionUntil(round);
  const noticeLimit = addMonthsToDateString(today, CONTRACT_ARCHIVE_NOTICE_MONTHS);
  return {
    retentionUntil,
    needsArchive: !file.archivedAt && !file.purgedAt && retentionUntil <= noticeLimit,
    retentionEnded: retentionUntil < today,
  };
}
