import DOMPurify from 'dompurify';

// D62 — 공지 본문(HTML)을 보일 때 한 번 더 거른다(서버 sanitize-html 다음 두 번째 방어선). 허용 목록은 api
// `post-content.ts` POST_ALLOWED_TAGS와 같게 둔다. 예전 평문 글(태그로 시작하지 않음)은 HTML로 해석하지 않는다.
const ALLOWED_TAGS = ['p', 'br', 'h2', 'h3', 'strong', 'em', 's', 'u', 'ul', 'ol', 'li', 'blockquote', 'hr', 'a', 'code', 'pre'];

export function isHtmlContent(content: string): boolean {
  return /^\s*<(p|h2|h3|ul|ol|blockquote|hr|pre)[\s>/]/i.test(content);
}

export function sanitizeRich(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
  });
}
