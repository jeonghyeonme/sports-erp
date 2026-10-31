import { api } from './api';
import { isAbsoluteUrl } from './post-attachments';
import { ApiEnvelope } from './types';

// D69 — 위탁계약 계약서·해지 합의서. 게시판 첨부와 같은 저장소·한도(D57)지만 경로는 계약 전용이다.
// 1) 업로드 URL 받기 → 2) 저장소로 직접 PUT → 3) 갱신·지점 등록·파일 올리기 요청에 {path, fileName}을 싣는다.
export { ATTACHMENT_ACCEPT as CONTRACT_FILE_ACCEPT, ATTACHMENT_MAX_BYTES as CONTRACT_FILE_MAX_BYTES } from './post-attachments';

export async function uploadContractFile(file: File): Promise<{ path: string; fileName: string }> {
  const { data } = await api.post<ApiEnvelope<{ path: string; uploadUrl: string }>>('/branches/contract-files/upload-url', {
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

// 계약 파일 열기 — 서버가 열람 기록을 남긴 뒤 60초짜리 URL을 준다(D69 결정 8). 로컬 메모리 저장소는 api 상대 경로다.
export async function openContractFile(branchId: string, fileId: string, fileName: string): Promise<void> {
  const { data } = await api.get<ApiEnvelope<{ url: string }>>(`/branches/${branchId}/contract/files/${fileId}/download`);
  const url = data.data!.url;
  if (isAbsoluteUrl(url)) {
    window.location.assign(url);
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
