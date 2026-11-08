import { api } from './api';
import { openStoredUrl, uploadStoredFile } from './stored-files';
import { ApiEnvelope, DocumentRow } from './types';

// D69 2차(log/206) — 문서 파일(인사서류·매뉴얼·기타). 게시판 첨부와 같은 형식·한도(D57), 경로는 문서 전용.
export { ATTACHMENT_ACCEPT as DOCUMENT_FILE_ACCEPT, ATTACHMENT_MAX_BYTES as DOCUMENT_FILE_MAX_BYTES } from './post-attachments';

export function uploadDocumentFile(file: File): Promise<{ path: string; fileName: string }> {
  return uploadStoredFile('/documents/upload-url', file);
}

/**
 * 문서 열기 — 서버가 열람 기록을 남긴다. 올린 파일은 60초 URL로 내려받고, 옛 주소 문서(외부 링크)는 새 탭으로 연다.
 */
export async function openDocument(doc: Pick<DocumentRow, 'id' | 'title' | 'fileName'>): Promise<void> {
  const { data } = await api.get<ApiEnvelope<{ url: string; external: boolean }>>(`/documents/${doc.id}/open`);
  const { url, external } = data.data!;
  await openStoredUrl(url, doc.fileName ?? doc.title, { newTab: external });
}
