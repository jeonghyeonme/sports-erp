import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
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

  function toggleLink() {
    if (!editor) return;
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const href = window.prompt('링크 주소(https://…)');
    if (!href) return;
    if (!/^(https?:\/\/|mailto:)/i.test(href)) {
      window.alert('http(s):// 또는 mailto: 로 시작하는 주소만 넣을 수 있습니다.');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }

  const chain = () => editor.chain().focus();
  return (
    <div className="rich-editor">
      <div className="rich-toolbar" role="toolbar" aria-label="서식">
        {btn('제목', '제목', state?.h2 ?? false, () => chain().toggleHeading({ level: 2 }).run())}
        {btn('소제목', '소제목', state?.h3 ?? false, () => chain().toggleHeading({ level: 3 }).run())}
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
        {btn('링크', '링크', state?.link ?? false, toggleLink)}
        <span className="rich-sep" />
        {btn('되돌리기', '↶', false, () => chain().undo().run())}
        {btn('다시 하기', '↷', false, () => chain().redo().run())}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
