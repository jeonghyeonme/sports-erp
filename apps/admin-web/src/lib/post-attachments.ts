import { api } from './api';
import { ApiEnvelope, AttachmentRow } from './types';

// 게시판 ADR-BRD-04(저장소 D57) — 첨부 한 개 올리기: 업로드 URL 받기 → 저장소로 직접 PUT → api에 붙이기.
// 첨부 칸(PostAttachments)과 새 글 등록 직후 대기 파일 올리기(PostEditorPage)가 같이 쓴다.
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_MAX_FILES = 5;
export const ATTACHMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.pptx,.hwp';

// 메모리 드라이버(로컬)는 api 상대 경로를 준다 — 그때만 api 클라이언트로(토큰 포함) 부른다.
// 저장소 서명 URL(절대 주소)에는 우리 토큰을 붙이지 않는다(Supabase가 다른 토큰으로 읽어 거부한다).
export function isAbsoluteUrl(url: string) {
  return /^https?:\/\//.test(url);
}

export async function uploadAttachment(postId: string, file: File): Promise<AttachmentRow> {
  const { data } = await api.post<ApiEnvelope<{ path: string; uploadUrl: string }>>(`/posts/${postId}/attachments/upload-url`, {
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
  const added = await api.post<ApiEnvelope<AttachmentRow>>(`/posts/${postId}/attachments`, { path, fileName: file.name });
  return added.data.data!;
}
