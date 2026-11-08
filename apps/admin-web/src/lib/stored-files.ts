import { api } from './api';
import { isAbsoluteUrl } from './post-attachments';
import { ApiEnvelope } from './types';

// 저장소에 직접 올리고 여는 파일(D57 방식) — 계약 파일(D69)·문서 파일(D69 2차, log/206)이 같이 쓴다.
// 올리기: 업로드 URL 받기 → 저장소로 직접 PUT → 등록 요청에 {path, fileName}을 싣는다.
// 열기: 서버가 열람 기록을 남긴 뒤 60초 URL을 준다. 로컬 메모리 저장소는 api 상대 경로다.

export async function uploadStoredFile(uploadUrlEndpoint: string, file: File): Promise<{ path: string; fileName: string }> {
  const { data } = await api.post<ApiEnvelope<{ path: string; uploadUrl: string }>>(uploadUrlEndpoint, {
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  });
  const { path, uploadUrl } = data.data!;
  if (isAbsoluteUrl(uploadUrl)) {
    const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!res.ok) throw new Error(`저장소 업로드 실패(${res.status})`);
  } else {
    await api.put(uploadUrl, file, { headers: { 'Content-Type': file.type } });
  }
  return { path, fileName: file.name };
}

/** 서버가 준 URL로 연다. 저장소 서명 URL·외부 주소는 그대로 이동, 로컬 메모리 저장소(api 상대 경로)는 내려받는다. */
export async function openStoredUrl(url: string, fileName: string, opts: { newTab?: boolean } = {}): Promise<void> {
  if (isAbsoluteUrl(url)) {
    if (opts.newTab) window.open(url, '_blank', 'noopener,noreferrer');
    else window.location.assign(url);
    return;
  }
  const res = await api.get<Blob>(url, { responseType: 'blob' });
  const objectUrl = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
