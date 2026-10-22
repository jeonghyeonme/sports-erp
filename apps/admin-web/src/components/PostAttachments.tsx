import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '../lib/api';
import { apiErrorMessage } from '../lib/use-api-list';
import { useToast } from '../lib/use-toast';
import { ApiEnvelope, AttachmentRow, PostRow } from '../lib/types';
import {
  ATTACHMENT_ACCEPT as ACCEPT,
  ATTACHMENT_MAX_BYTES as MAX_BYTES,
  ATTACHMENT_MAX_FILES as MAX_FILES,
  isAbsoluteUrl as isAbsolute,
  uploadAttachment,
} from '../lib/post-attachments';

// 게시판 ADR-BRD-04(저장소 D57) — 첨부 목록·내려받기·올리기·지우기.
// 올리기: api에 업로드 URL을 받아 → 그 URL로 파일을 직접 PUT → api에 붙이기(api가 저장소에서 크기·형식을 다시 확인).
// 받기: api가 60초짜리 다운로드 URL을 준다. 파일은 api(Lambda, 본문 6MB 한도)를 거치지 않는다.


function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}


// 이미지(png·jpg·webp)는 목록 위에 바로 그린다 — 회원 웹 NoticeAttachments와 같은 방식(log/144).
// 다운로드 URL이 60초짜리라 화면을 열 때 이미지마다 한 번씩 받는다(글당 첨부 5개 상한).
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function AttachmentImage({ postId, attachment }: { postId: string; attachment: AttachmentRow }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    (async () => {
      const { data } = await api.get<ApiEnvelope<{ url: string }>>(`/posts/${postId}/attachments/${attachment.id}/download`);
      const url = data.data!.url;
      if (isAbsolute(url)) return url;
      const res = await api.get<Blob>(url, { responseType: 'blob' });
      objectUrl = URL.createObjectURL(res.data);
      return objectUrl;
    })().then(
      (url) => alive && setSrc(url),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [postId, attachment.id]);

  if (failed) return <p className="page-desc">이미지를 불러오지 못했습니다({attachment.fileName}).</p>;
  if (!src) return <div className="attachment-image attachment-image-loading" aria-label="이미지 불러오는 중" />;
  return <img className="attachment-image" src={src} alt={attachment.fileName} loading="lazy" onError={() => setFailed(true)} />;
}

export function PostAttachments({
  postId,
  attachments,
  canUpload,
  canDelete,
}: {
  postId: string;
  attachments: AttachmentRow[];
  canUpload: boolean;
  canDelete: boolean;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // 상세를 다시 부르면 조회수가 오른다 — 캐시의 첨부 목록만 고친다(PostDetailPage의 ['posts', id]).
  const patchList = (update: (list: AttachmentRow[]) => AttachmentRow[]) =>
    queryClient.setQueryData<PostRow>(['posts', postId], (old) => (old ? { ...old, attachments: update(old.attachments ?? []) } : old));

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error('파일 하나는 10MB까지 올릴 수 있습니다.');
      return;
    }
    setBusy('upload');
    try {
      const added = await uploadAttachment(postId, file);
      patchList((list) => [...list, added]);
      toast.success(`${file.name}을(를) 첨부했습니다.`);
    } catch (err) {
      toast.error(apiErrorMessage(err as AxiosError) ?? (err as Error).message ?? '첨부하지 못했습니다.');
    } finally {
      setBusy(null);
    }
  }

  async function download(a: AttachmentRow) {
    setBusy(a.id);
    try {
      const { data } = await api.get<ApiEnvelope<{ url: string }>>(`/posts/${postId}/attachments/${a.id}/download`);
      const url = data.data!.url;
      if (isAbsolute(url)) {
        window.location.assign(url);
      } else {
        const res = await api.get<Blob>(url, { responseType: 'blob' });
        const objectUrl = URL.createObjectURL(res.data);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = a.fileName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
    } catch (err) {
      toast.error(apiErrorMessage(err as AxiosError) ?? '내려받지 못했습니다.');
    } finally {
      setBusy(null);
    }
  }

  async function remove(a: AttachmentRow) {
    setBusy(a.id);
    try {
      await api.delete(`/posts/${postId}/attachments/${a.id}`);
      patchList((list) => list.filter((x) => x.id !== a.id));
      toast.success(`${a.fileName}을(를) 지웠습니다.`);
    } catch (err) {
      toast.error(apiErrorMessage(err as AxiosError) ?? '지우지 못했습니다.');
    } finally {
      setBusy(null);
    }
  }

  if (attachments.length === 0 && !canUpload) return null;

  return (
    <div className="detail-section" style={{ marginTop: 16 }}>
      <h3 className="section-title">첨부 파일 {attachments.length > 0 && `(${attachments.length})`}</h3>
      {attachments
        .filter((a) => IMAGE_TYPES.includes(a.fileType))
        .map((a) => (
          <AttachmentImage key={a.id} postId={postId} attachment={a} />
        ))}
      {attachments.length > 0 && (
        <ul className="attachment-list">
          {attachments.map((a) => (
            <li key={a.id}>
              <button type="button" className="link-button" disabled={busy !== null} onClick={() => download(a)}>
                {a.fileName}
              </button>
              <span className="page-desc"> {sizeLabel(a.fileSize)}</span>
              {canDelete && (
                <button
                  type="button"
                  className="btn-danger-outline"
                  style={{ marginLeft: 8, padding: '2px 8px' }}
                  disabled={busy !== null}
                  onClick={() => remove(a)}
                >
                  삭제
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canUpload && (
        <div className="action-row" style={{ alignItems: 'center' }}>
          <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={upload} />
          <button
            type="button"
            className="btn-secondary"
            disabled={busy !== null || attachments.length >= MAX_FILES}
            onClick={() => inputRef.current?.click()}
          >
            {busy === 'upload' ? '올리는 중...' : '+ 파일 첨부'}
          </button>
          <span className="page-desc">
            PDF·이미지·오피스·한글, 파일당 10MB, 글당 {MAX_FILES}개({attachments.length}/{MAX_FILES})
          </span>
        </div>
      )}
    </div>
  );
}
