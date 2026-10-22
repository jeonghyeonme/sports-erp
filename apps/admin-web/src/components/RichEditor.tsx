import { KeyboardEvent, useState } from 'react';
import { ChainedCommands, EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

// D62 — 게시글 본문 편집기(WYSIWYG, TipTap StarterKit). 만들 수 있는 서식은 서버 허용 목록(post-content.ts)과 같다 —
// 제목 2·3단계, 굵게·기울임·취소선·밑줄, 글머리·번호 목록, 인용, 구분선, 링크. 이미지는 본문에 넣지 않고 첨부로 올린다.
export function RichEditor({
  initialContent,
  onChange,
  label,
}: {
  initialContent: string;
  onChange: (html: string) => void;
  label: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        link: { openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto'] },
      }),
    ],
    content: initialContent,
    editorProps: { attributes: { class: 'rich-editor-body', 'aria-label': label, role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  });
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive('bold') ?? false,
      italic: e?.isActive('italic') ?? false,
      strike: e?.isActive('strike') ?? false,
      underline: e?.isActive('underline') ?? false,
      h2: e?.isActive('heading', { level: 2 }) ?? false,
      h3: e?.isActive('heading', { level: 3 }) ?? false,
      bullet: e?.isActive('bulletList') ?? false,
      ordered: e?.isActive('orderedList') ?? false,
      quote: e?.isActive('blockquote') ?? false,
      link: e?.isActive('link') ?? false,
    }),
  });
  // 링크 주소 입력칸(브라우저 prompt 대신) — 열 때의 선택 범위를 기억해 두었다가 적용한다.
  const [linkForm, setLinkForm] = useState<{ from: number; to: number; href: string; error: string } | null>(null);
  if (!editor) return null;

  const btn = (title: string, text: string, active: boolean, run: () => void) => (
    <button
      type="button"
      className={active ? 'rich-tool active' : 'rich-tool'}
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()} // 편집기 선택을 잃지 않게
      onClick={run}
    >
      {text}
    </button>
  );

  function openLink() {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const current = (editor.getAttributes('link').href as string | undefined) ?? '';
    setLinkForm({ from, to, href: current, error: '' });
  }

  function applyLink() {
    if (!editor || !linkForm) return;
    const href = linkForm.href.trim();
    if (!/^(https?:\/\/|mailto:)\S+$/i.test(href)) {
      setLinkForm({ ...linkForm, error: 'http:// · https:// · mailto: 로 시작하는 주소만 넣을 수 있습니다.' });
      return;
    }
    const c = editor.chain().focus().setTextSelection({ from: linkForm.from, to: linkForm.to });
    if (linkForm.from === linkForm.to && !editor.isActive('link')) {
      // 고른 글자가 없으면 주소 자체를 링크 글자로 넣는다
      c.insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
    } else {
      c.extendMarkRange('link').setLink({ href }).run();
    }
    setLinkForm(null);
  }

  function removeLink() {
    if (!editor || !linkForm) return;
    editor.chain().focus().setTextSelection({ from: linkForm.from, to: linkForm.to }).extendMarkRange('link').unsetLink().run();
    setLinkForm(null);
  }

  function linkKey(e: KeyboardEvent<HTMLInputElement>) {
    // 바깥 글쓰기 form이 Enter로 제출되지 않게 막는다
    if (e.key === 'Enter') {
      e.preventDefault();
      applyLink();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setLinkForm(null);
      editor?.commands.focus();
    }
  }

  // 제목·소제목은 문단 단위 서식이다. 문단 안의 일부만 골랐으면 그 앞뒤를 끊어 고른 부분만 바꾼다
  // (끊지 않으면 한 문단으로 쓴 글 전체가 제목이 된다).
  function blockStyle(apply: (c: ChainedCommands) => ChainedCommands) {
    if (!editor) return;
    const { from, to, empty, $from, $to } = editor.state.selection;
    let c = editor.chain().focus();
    if (!empty && $from.sameParent($to) && $from.parent.isTextblock) {
      const atEnd = $to.parentOffset === $to.parent.content.size;
      const atStart = $from.parentOffset === 0;
      if (!atEnd) c = c.setTextSelection(to).splitBlock({ keepMarks: false });
      let start = from;
      if (!atStart) {
        c = c.setTextSelection(from).splitBlock({ keepMarks: false });
        start = from + 2; // 끊으면 닫는·여는 자리 2칸이 생긴다
      }
      c = c.setTextSelection(start);
    }
    apply(c).run();
  }

  const chain = () => editor.chain().focus();
  return (
    <div className="rich-editor">
      <div className="rich-toolbar" role="toolbar" aria-label="서식">
        {btn('제목', '제목', state?.h2 ?? false, () => blockStyle((c) => c.toggleHeading({ level: 2 })))}
        {btn('소제목', '소제목', state?.h3 ?? false, () => blockStyle((c) => c.toggleHeading({ level: 3 })))}
        <span className="rich-sep" />
        {btn('굵게', 'B', state?.bold ?? false, () => chain().toggleBold().run())}
        {btn('기울임', 'I', state?.italic ?? false, () => chain().toggleItalic().run())}
        {btn('밑줄', 'U', state?.underline ?? false, () => chain().toggleUnderline().run())}
        {btn('취소선', 'S', state?.strike ?? false, () => chain().toggleStrike().run())}
        <span className="rich-sep" />
        {btn('글머리 목록', '• 목록', state?.bullet ?? false, () => chain().toggleBulletList().run())}
        {btn('번호 목록', '1. 목록', state?.ordered ?? false, () => chain().toggleOrderedList().run())}
        {btn('인용', '인용', state?.quote ?? false, () => chain().toggleBlockquote().run())}
        {btn('구분선', '―', false, () => chain().setHorizontalRule().run())}
        {btn('링크', '링크', (state?.link ?? false) || !!linkForm, openLink)}
        <span className="rich-sep" />
        {btn('되돌리기', '↶', false, () => chain().undo().run())}
        {btn('다시 하기', '↷', false, () => chain().redo().run())}
      </div>
      {linkForm && (
        <div className="rich-link-form">
          <input
            autoFocus
            type="url"
            aria-label="링크 주소"
            placeholder="https://"
            value={linkForm.href}
            onChange={(e) => setLinkForm({ ...linkForm, href: e.target.value, error: '' })}
            onKeyDown={linkKey}
          />
          <button type="button" className="btn-secondary primary" onClick={applyLink}>
            적용
          </button>
          {editor.isActive('link') && (
            <button type="button" className="btn-secondary" onClick={removeLink}>
              링크 빼기
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={() => setLinkForm(null)}>
            취소
          </button>
          {linkForm.error && <span className="rich-link-error">{linkForm.error}</span>}
          {!linkForm.error && linkForm.from === linkForm.to && !editor.isActive('link') && (
            <span className="page-desc">고른 글자가 없으면 주소가 그대로 링크 글자로 들어갑니다.</span>
          )}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
