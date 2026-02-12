"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded px-2 py-1 text-xs font-medium transition ${
        active
          ? "bg-[var(--brand-primary)] text-white"
          : "text-[var(--foreground)] hover:bg-[var(--muted)]"
      }`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  minHeight = "120px",
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none px-3 py-2`,
        style: `min-height: ${minHeight}`,
      },
    },
  });

  // Sync external value changes (e.g. form reset)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // Only re-sync when value changes externally, not on every keystroke
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--border)] bg-[var(--muted)] px-2 py-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <em>I</em>
        </ToolbarButton>
        <div className="mx-1 h-4 w-px bg-[var(--border)]" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          H3
        </ToolbarButton>
        <div className="mx-1 h-4 w-px bg-[var(--border)]" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet List"
        >
          {/* Bullet list icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <circle cx="3" cy="6" r="1.5" fill="currentColor" />
            <circle cx="3" cy="12" r="1.5" fill="currentColor" />
            <circle cx="3" cy="18" r="1.5" fill="currentColor" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered List"
        >
          {/* Ordered list icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="10" y1="6" x2="21" y2="6" />
            <line x1="10" y1="12" x2="21" y2="12" />
            <line x1="10" y1="18" x2="21" y2="18" />
            <text x="1" y="8" fontSize="8" fill="currentColor" stroke="none" fontFamily="sans-serif">1</text>
            <text x="1" y="14" fontSize="8" fill="currentColor" stroke="none" fontFamily="sans-serif">2</text>
            <text x="1" y="20" fontSize="8" fill="currentColor" stroke="none" fontFamily="sans-serif">3</text>
          </svg>
        </ToolbarButton>
        <div className="mx-1 h-4 w-px bg-[var(--border)]" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Blockquote"
        >
          {/* Blockquote icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" />
            <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          title="Code Block"
        >
          {"</>"}
        </ToolbarButton>

        {/* Future: AI Generate button placeholder */}
        {/* <ToolbarButton onClick={() => {}} title="AI Generate">AI</ToolbarButton> */}
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}
