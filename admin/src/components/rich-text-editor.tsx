import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { BoldIcon, ItalicIcon, ListIcon, ListOrderedIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sanitizeInstructionsHtml } from '@/lib/sanitize-html';

type RichTextEditorProps = {
  id?: string;
  value: string;
  disabled?: boolean;
  onChange: (html: string) => void;
  className?: string;
  'aria-label'?: string;
};

export function RichTextEditor({
  id,
  value,
  disabled = false,
  onChange,
  className,
  'aria-label': ariaLabel = 'Rich text editor',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
      }),
    ],
    content: value || '',
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id: id ?? '',
        class:
          'rich-text-editor-content min-h-32 max-h-64 overflow-y-auto px-3 py-2 text-sm outline-none focus-visible:outline-none',
        'aria-label': ariaLabel,
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(sanitizeInstructionsHtml(ed.getHTML()));
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const current = sanitizeInstructionsHtml(editor.getHTML());
    const next = sanitizeInstructionsHtml(value || '');
    if (current === next) return;
    editor.commands.setContent(value || '', { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-input bg-background shadow-xs',
        disabled ? 'opacity-60' : null,
        className,
      )}
    >
      <div
        className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 p-1.5"
        role="toolbar"
        aria-label="Formatting"
      >
        <Button
          type="button"
          variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
          size="icon"
          disabled={disabled}
          aria-label="Bold"
          aria-pressed={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
          size="icon"
          disabled={disabled}
          aria-label="Italic"
          aria-pressed={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
          size="icon"
          disabled={disabled}
          aria-label="Bullet list"
          aria-pressed={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <ListIcon />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
          size="icon"
          disabled={disabled}
          aria-label="Numbered list"
          aria-pressed={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrderedIcon />
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
