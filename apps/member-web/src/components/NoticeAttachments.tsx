import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { describeError } from '../lib/errors';
import { Attachment } from '../lib/types';

// 게시판 ADR-BRD-04·F4-3(log/133) — 회원 웹 공지 첨부. 이미지(png·jpg·webp)는 본문 아래에 바로 그리고,
// 그 밖의 파일은 이름만 두고 누를 때 내려받는다. 다운로드 URL은 60초짜리라 이미지는 화면을 열 때 한 번씩 받는다
// (이미지 수만큼 호출이 는다 — 글당 첨부는 5개까지라 상한이 있다).
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

// 메모리 드라이버(로컬)는 api 상대 경로(dev-storage, 공개 경로)를, Supabase는 절대 서명 URL을 준다.
const resolve = (url: string) => (/^https?:\/\//.test(url) ? url : `/api/v1/${url}`);

async function downloadUrl(postId: string, attachmentId: string): Promise<string> {
  const { data } = await api.get<{ data: { url: string } }>(`/posts/${postId}/attachments/${attachmentId}/download`);
  return resolve(data.data.url);
}

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function NoticeImage({ postId, attachment }: { postId: string; attachment: Attachment }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    downloadUrl(postId, attachment.id).then(
      (url) => alive && setSrc(url),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [postId, attachment.id]);

  if (failed) return <p className="muted">이미지를 불러오지 못했습니다({attachment.fileName}).</p>;
  if (!src) return <div className="notice-image notice-image-loading" aria-label="이미지 불러오는 중" />;
  return <img className="notice-image" src={src} alt={attachment.fileName} loading="lazy" onError={() => setFailed(true)} />;
}

export function NoticeAttachments({ postId, attachments }: { postId: string; attachments: Attachment[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (attachments.length === 0) return null;
  const images = attachments.filter((a) => IMAGE_TYPES.includes(a.fileType));
  const files = attachments.filter((a) => !IMAGE_TYPES.includes(a.fileType));

  async function open(a: Attachment) {
    setBusy(a.id);
    setError(null);
    try {
      window.location.assign(await downloadUrl(postId, a.id));
    } catch (err) {
      setError(describeError(err, '파일을 내려받지 못했습니다.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack-sm">
      {images.map((a) => (
        <NoticeImage key={a.id} postId={postId} attachment={a} />
      ))}
      {files.length > 0 && (
        <ul className="notice-files">
          {files.map((a) => (
            <li key={a.id}>
              <button type="button" className="text-button notice-file-button" disabled={busy !== null} onClick={() => open(a)}>
                {a.fileName}
              </button>
              <span className="muted"> {sizeLabel(a.fileSize)}</span>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
