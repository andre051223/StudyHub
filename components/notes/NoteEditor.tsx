'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import {
  ArrowLeft,
  Bold,
  Italic,
  List,
  ListOrdered,
  ListChecks,
  Code2,
  Quote,
  Link2,
  Image as ImageIcon,
  Heading1,
  Heading2,
  Heading3,
  Trash2,
  Tag,
  Folder,
  X,
  Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Note, Folder as FolderType } from '@/lib/types';

const lowlight = createLowlight(common);

interface Props {
  note: Note;
  folders: Pick<FolderType, 'id' | 'name'>[];
}

export function NoteEditor({ note, folders }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [title, setTitle] = useState(note.title);
  const [folderId, setFolderId] = useState<string | null>(note.folder_id);
  const [tags, setTags] = useState<string[]>(note.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Heading.configure({ levels: [1, 2, 3] }),
      CodeBlockLowlight.configure({ lowlight }),
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Empieza a escribir tus apuntes...' }),
    ],
    content: Object.keys(note.content ?? {}).length > 0 ? note.content : undefined,
    onUpdate: () => {
      setSaveStatus('unsaved');
      scheduleAutosave();
    },
  });

  const scheduleAutosave = useCallback(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      doSave();
    }, 1000);
  }, []);

  async function doSave() {
    if (!editor) return;
    setSaveStatus('saving');
    const content = editor.getJSON();
    const content_text = editor.getText();

    const { error } = await supabase
      .from('notes')
      .update({ title, content, content_text, folder_id: folderId, tags })
      .eq('id', note.id);

    setSaveStatus(error ? 'unsaved' : 'saved');
  }

  // Save on title/folder/tags change
  useEffect(() => {
    if (saveStatus === 'saved') return;
    scheduleAutosave();
  }, [title, folderId, tags]);

  async function handleImageUpload(file: File) {
    const path = `${(await supabase.auth.getUser()).data.user?.id}/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from('notes-images')
      .upload(path, file);
    if (error) { toast.error('Error al subir imagen'); return null; }
    const { data: { publicUrl } } = supabase.storage.from('notes-images').getPublicUrl(path);
    return publicUrl;
  }

  async function handleImageInsert() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const url = await handleImageUpload(file);
      if (url) editor?.chain().focus().setImage({ src: url }).run();
    };
    input.click();
  }

  async function handleDelete() {
    await supabase.from('notes').delete().eq('id', note.id);
    toast.success('Nota eliminada');
    router.push('/notes');
  }

  function addTag(tag: string) {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      const next = [...tags, t];
      setTags(next);
      setSaveStatus('unsaved');
    }
    setTagInput('');
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
    setSaveStatus('unsaved');
  }

  if (!editor) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] bg-[var(--color-surface)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-[var(--color-gray-border)]">
        <button
          onClick={() => router.push('/notes')}
          className="p-2 rounded-lg hover:bg-[var(--color-gray-light)] text-[var(--color-text-soft)] transition-colors"
          aria-label="Volver"
        >
          <ArrowLeft size={18} />
        </button>

        {/* Folder selector */}
        <select
          value={folderId ?? ''}
          onChange={(e) => { setFolderId(e.target.value || null); setSaveStatus('unsaved'); }}
          className="text-sm border border-[var(--color-gray-border)] rounded-lg px-3 py-1.5 text-[var(--color-text-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] max-w-40"
        >
          <option value="">Inbox</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>

        {/* Save status */}
        <span className={`ml-auto text-xs flex items-center gap-1.5 ${
          saveStatus === 'saved'
            ? 'text-[var(--color-primary)]'
            : saveStatus === 'saving'
            ? 'text-[var(--color-gray-mid)]'
            : 'text-yellow-500'
        }`}>
          {saveStatus === 'saved' && <><Check size={12} /> Guardado</>}
          {saveStatus === 'saving' && 'Guardando...'}
          {saveStatus === 'unsaved' && 'Sin guardar'}
        </span>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/15 text-[var(--color-gray-mid)] hover:text-red-500 transition-colors"
            aria-label="Eliminar nota"
          >
            <Trash2 size={16} />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600">¿Eliminar?</span>
            <button onClick={handleDelete} className="text-xs px-2 py-1 bg-red-600 text-white rounded">Sí</button>
            <button onClick={() => setShowDeleteConfirm(false)} className="text-xs px-2 py-1 border rounded">No</button>
          </div>
        )}
      </div>

      {/* Tags bar */}
      <div className="flex items-center gap-2 px-6 py-2 border-b border-[var(--color-gray-border)] flex-wrap">
        <Tag size={13} className="text-[var(--color-gray-mid)] flex-shrink-0" />
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-[#67b31f1a] text-[var(--color-primary)]"
          >
            #{tag}
            <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addTag(tagInput);
            }
          }}
          placeholder="Añadir tag..."
          className="text-xs border-none outline-none bg-transparent text-[var(--color-text-soft)] placeholder:text-[var(--color-gray-mid)] min-w-24"
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-4 py-2 border-b border-[var(--color-gray-border)] overflow-x-auto flex-wrap">
        {[
          { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), label: 'Negrita' },
          { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), label: 'Cursiva' },
          null,
          { icon: Heading1, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }), label: 'H1' },
          { icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }), label: 'H2' },
          { icon: Heading3, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }), label: 'H3' },
          null,
          { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), label: 'Lista' },
          { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), label: 'Lista ordenada' },
          { icon: ListChecks, action: () => editor.chain().focus().toggleTaskList().run(), active: editor.isActive('taskList'), label: 'Lista de tareas' },
          null,
          { icon: Code2, action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock'), label: 'Código' },
          { icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote'), label: 'Cita' },
          null,
          { icon: ImageIcon, action: handleImageInsert, active: false, label: 'Imagen' },
        ].map((item, i) => {
          if (item === null) {
            return <div key={i} className="w-px h-5 bg-[var(--color-gray-border)] mx-1" />;
          }
          const { icon: Icon, action, active, label } = item;
          return (
            <button
              key={label}
              onClick={action}
              aria-label={label}
              className={`p-2 rounded-lg transition-colors ${
                active
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-text-soft)] hover:bg-[var(--color-gray-light)]'
              }`}
            >
              <Icon size={15} />
            </button>
          );
        })}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setSaveStatus('unsaved'); }}
            onBlur={() => saveStatus === 'unsaved' && doSave()}
            placeholder="Título de la nota"
            className="w-full text-3xl font-bold text-[var(--color-text)] border-none outline-none mb-6 placeholder:text-[var(--color-gray-border)]"
          />
          <EditorContent
            editor={editor}
            className="prose prose-sm max-w-none text-[var(--color-text)]"
          />
        </div>
      </div>
    </div>
  );
}
