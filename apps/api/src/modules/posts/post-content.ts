import sanitizeHtml from 'sanitize-html';

/**
 * D62 — 게시글 본문은 서식 있는 HTML로 저장하되, 저장 전에 허용 목록으로 정화한다(두 웹도 DOMPurify로 한 번 더).
 * 회원 웹은 갱신 토큰이 localStorage에 있어(D41) XSS 한 번이면 세션이 탈취된다 — 스크립트·이벤트 속성·style·img·
 * iframe은 남기지 않고, 링크는 http(s)·mailto만, 새 창으로 열 때 rel="noopener noreferrer nofollow"를 붙인다.
 * 편집기(TipTap StarterKit)가 만드는 태그만 허용한다. 예전 평문 글은 그대로 두고 화면이 평문으로 보인다.
 */
export const POST_ALLOWED_TAGS = ['p', 'br', 'h2', 'h3', 'strong', 'em', 's', 'u', 'ul', 'ol', 'li', 'blockquote', 'hr', 'a', 'code', 'pre'];

// 태그 없이 온 글(api 직접 호출·예전 화면)은 줄마다 문단으로 바꿔 HTML로 저장한다 — 저장되는 새 글은 모두 HTML이다.
function textToHtml(text: string): string {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .split(/\r?\n/)
    .map((line) => `<p>${esc(line)}</p>`)
    .join('');
}

export function sanitizePostContent(input: string): string {
  const html = /^\s*</.test(input) ? input : textToHtml(input);
  const out = sanitizeHtml(html, {
    allowedTags: POST_ALLOWED_TAGS,
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href'],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { href: attribs.href ?? '', target: '_blank', rel: 'noopener noreferrer nofollow' },
      }),
    },
  }).trim();
  // 화면은 블록 태그로 시작해야 HTML로 본다(예전 평문 글과 구분) — 인라인으로 시작하면 문단으로 감싼다.
  return out === '' || /^<(p|h2|h3|ul|ol|blockquote|hr|pre)[\s>/]/i.test(out) ? out : `<p>${out}</p>`;
}

/** 정화 뒤 글자가 남는지 — `<p></p>`만 남은 본문은 빈 글이다. */
export function hasText(html: string): boolean {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;/g, ' ').trim().length > 0;
}
