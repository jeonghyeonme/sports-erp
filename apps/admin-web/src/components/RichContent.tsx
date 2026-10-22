import { isHtmlContent, sanitizeRich } from '../lib/rich-content';

// D62 — 게시글 본문 보기. 서식 있는 글은 정화한 HTML로, 예전 평문 글은 줄바꿈을 살린 글자로.
export function RichContent({ content }: { content: string }) {
  if (!isHtmlContent(content)) {
    return <p style={{ whiteSpace: 'pre-wrap', marginTop: 16 }}>{content}</p>;
  }
  return <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeRich(content) }} />;
}
