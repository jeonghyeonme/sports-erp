import { useState } from 'react';
import { CsvColumn, downloadCsv, EXPORT_MAX_ROWS, toCsv } from '../lib/csv';
import { useToast } from '../lib/use-toast';
import { apiErrorMessage } from '../lib/use-api-list';
import { AxiosError } from 'axios';

// 목록 위 "CSV 내려받기" — 지금 조건 그대로 전체(쪽 단위면 모든 쪽)를 받아 파일로 저장한다(M6).
export function ExportCsvButton<T>({
  filename,
  columns,
  load,
  disabled,
}: {
  filename: string;
  columns: CsvColumn<T>[];
  load: () => Promise<{ rows: T[]; truncated?: boolean }>;
  disabled?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const { rows, truncated } = await load();
      if (rows.length === 0) {
        toast.warning('내려받을 행이 없습니다.');
        return;
      }
      downloadCsv(filename, toCsv(rows, columns));
      if (truncated) toast.warning(`처음 ${EXPORT_MAX_ROWS.toLocaleString()}행까지만 받았습니다. 조건을 좁혀 나눠 받으세요.`);
      else toast.success(`${rows.length.toLocaleString()}행을 ${filename}으로 받았습니다.`);
    } catch (e) {
      toast.error(apiErrorMessage(e as AxiosError) ?? '내려받지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn-secondary" onClick={run} disabled={disabled || busy}>
      {busy ? '내려받는 중...' : 'CSV 내려받기'}
    </button>
  );
}
