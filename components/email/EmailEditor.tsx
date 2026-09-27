'use client';
import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyleKit } from '@tiptap/extension-text-style';
export default function EmailEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string, text: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Image,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Write something your recipients will love…' }),
      TextStyleKit,
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.getText()),
    editorProps: { attributes: { class: 'min-h-64 p-5 outline-none prose max-w-none' } },
  });
  useEffect(() => {
    if (editor && editor.getHTML() !== value)
      editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);
  if (!editor) return <div className="h-64 animate-pulse rounded-xl bg-slate-100" />;
  const buttons: [string, () => void, boolean][] = [
    ['B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold')],
    ['I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic')],
    ['U', () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline')],
    ['Strike', () => editor.chain().focus().toggleStrike().run(), editor.isActive('strike')],
    ...([1, 2, 3] as const).map(
      (level) =>
        [
          `H${level}`,
          () => editor.chain().focus().toggleHeading({ level }).run(),
          editor.isActive('heading', { level }),
        ] as [string, () => void, boolean],
    ),
    [
      'Bullets',
      () => editor.chain().focus().toggleBulletList().run(),
      editor.isActive('bulletList'),
    ],
    [
      'Numbered',
      () => editor.chain().focus().toggleOrderedList().run(),
      editor.isActive('orderedList'),
    ],
    [
      'Link',
      () => {
        const href = prompt('Link URL (https://…)');
        if (href && /^https?:\/\//i.test(href)) editor.chain().focus().setLink({ href }).run();
      },
      editor.isActive('link'),
    ],
    ['Unlink', () => editor.chain().focus().unsetLink().run(), false],
    [
      'Image',
      () => {
        const src = prompt('Public image URL (https://…)');
        if (src && /^https:\/\//i.test(src)) editor.chain().focus().setImage({ src }).run();
      },
      false,
    ],
    [
      'Left',
      () => editor.chain().focus().setTextAlign('left').run(),
      editor.isActive({ textAlign: 'left' }),
    ],
    [
      'Center',
      () => editor.chain().focus().setTextAlign('center').run(),
      editor.isActive({ textAlign: 'center' }),
    ],
    [
      'Right',
      () => editor.chain().focus().setTextAlign('right').run(),
      editor.isActive({ textAlign: 'right' }),
    ],
    ['Undo', () => editor.chain().focus().undo().run(), false],
    ['Redo', () => editor.chain().focus().redo().run(), false],
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap gap-1 border-b bg-slate-50 p-2">
        {buttons.map(([label, fn, active]) => (
          <button
            key={label}
            type="button"
            aria-label={
              label === 'B'
                ? 'Bold'
                : label === 'I'
                  ? 'Italic'
                  : label === 'U'
                    ? 'Underline'
                    : label
            }
            aria-pressed={active}
            onClick={fn}
            className={
              'rounded px-2 py-1.5 text-xs font-medium hover:bg-indigo-100 ' +
              (active ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600')
            }
          >
            {label}
          </button>
        ))}
        <input
          aria-label="Text color"
          type="color"
          className="h-8 w-8"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
