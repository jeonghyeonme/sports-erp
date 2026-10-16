import { api } from './api';
import { ApiEnvelope } from './types';

// RFP 권한관리 "출력"(D51 M6, 근거 ADR은 log/120 참고) — 목록을 CSV로 내려받는다. 브라우저에서 만들어 API 변경이 없다.
// 화면 목록과 같은 API를 쓰므로 전화번호는 이미 마스킹돼 있다(ADR-MEM-04) — 원문은 파일로 나가지 않는다.

export interface CsvColumn<T> {
  label: string;
  value: (row: T) => string | number | undefined | null;
}

// 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싼다. 글자 셀 맨 앞의 =,+,-,@는 엑셀 수식으로 읽혀 앞에 '를 붙인다(CSV 수식 주입 방지).
function cell(v: string | number | undefined | null): string {
  let s = v === undefined || v === null ? '' : String(v);
  if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`; // 숫자(음수 금액)는 그대로
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => cell(c.label)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => cell(c.value(r))).join(','));
  return lines.join('\r\n');
}

// 엑셀이 한글을 UTF-8로 읽도록 BOM을 붙인다. 파일 이름은 영문으로 — 한글 이름은 일부 브라우저(헤드리스 Chromium 실측)에서 "download"로 바뀐다.
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 바로 해제하면 일부 브라우저가 파일 이름(download 속성)을 잃는다 — 다음 틱에 해제한다.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const EXPORT_PAGE_SIZE = 100; // 서버 상한(MAX_PAGE_SIZE, D43)
export const EXPORT_MAX_ROWS = 5000; // 한 번에 내려받는 최대 행 — 넘으면 조건을 좁히게 한다

/** 쪽 단위 목록(D43)을 처음부터 끝까지 모은다. 상한을 넘으면 truncated=true. */
export async function fetchAllPages<T>(path: string, params: URLSearchParams): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let page = 1; rows.length < EXPORT_MAX_ROWS; page++) {
    const q = new URLSearchParams(params);
    q.set('page', String(page));
    q.set('limit', String(EXPORT_PAGE_SIZE));
    const res = await api.get<ApiEnvelope<T[]>>(`${path}?${q}`);
    const batch = res.data.data ?? [];
    rows.push(...batch);
    const total = Number(res.data.meta?.total ?? 0);
    if (batch.length < EXPORT_PAGE_SIZE || rows.length >= total) return { rows, truncated: false };
  }
  return { rows: rows.slice(0, EXPORT_MAX_ROWS), truncated: true };
}

/** 파일 이름용 KST 날짜(YYYY-MM-DD). */
export function kstDateStamp(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}
