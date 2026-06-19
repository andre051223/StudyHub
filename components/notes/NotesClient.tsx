'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Folder,
  FolderOpen,
  FileText,
  Tag,
  Trash2,
  MoreVertical,
  Inbox,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Folder as FolderType, Note } from '@/lib/types';
import { formatDate } from '@/lib/utils';

interface Props {
  initialFolders: (FolderType & { note_count?: { count: number }[] })[];
  initialNotes: Partial<Note>[];
}

export function NotesClient({ initialFolders, initialNotes }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [folders, setFolders] = useState(initialFolders);
  const [notes, setNotes] = useState(initialNotes);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | 'inbox'>('inbox');
  const [search, setSearch] = useState('');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [creatingNote, setCreatingNote] = useState(false);

  const allTags = Array.from(new Set(notes.flatMap((n) => n.tags ?? [])));

  const visibleNotes = notes.filter((n) => {
    if (selectedFolderId === 'inbox' && n.folder_id != null) return false;
    if (selectedFolderId !== 'inbox' && selectedFolderId !== null && n.folder_id !== selectedFolderId) return false;

    if (search) {
      const q = search.toLowerCase();
      if (
        !n.title?.toLowerCase().includes(q) &&
        !n.content_text?.toLowerCase().includes(q)
      )
        return false;
    }

    if (activeTagFilter && !n.tags?.includes(activeTagFilter)) return false;

    return true;
  });

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    const { data, error } = await supabase
      .from('folders')
      .insert({ name: newFolderName.trim() })
      .select()
      .single();
    if (error) { toast.error('Error al crear carpeta'); return; }
    setFolders((prev) => [...prev, { ...data, note_count: [] }]);
    setNewFolderName('');
    setShowNewFolder(false);
    toast.success('Carpeta creada');
  }

  async function handleDeleteFolder(id: string) {
    if (!confirm('¿Eliminar esta carpeta? Las notas quedarán en Inbox.')) return;
    await supabase.from('folders').delete().eq('id', id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    if (selectedFolderId === id) setSelectedFolderId('inbox');
    toast.success('Carpeta eliminada');
  }

  async function handleCreateNote() {
    setCreatingNote(true);
    const { data, error } = await supabase
      .from('notes')
      .insert({
        title: 'Sin título',
        folder_id: selectedFolderId === 'inbox' ? null : selectedFolderId,
        content: {},
        content_text: '',
        tags: [],
      })
      .select()
      .single();
    setCreatingNote(false);
    if (error) { toast.error('Error al crear nota'); return; }
    setNotes((prev) => [data, ...prev]);
    router.push(`/notes/${data.id}`);
  }

  async function handleDeleteNote(id: string) {
    if (!confirm('¿Eliminar esta nota?')) return;
    await supabase.from('notes').delete().eq('id', id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    toast.success('Nota eliminada');
  }

  return (
    <div className="flex h-[calc(100vh-68px)]">
      {/* Sidebar */}
      <aside className="w-64 bg-[var(--color-surface)] border-r border-[var(--color-gray-border)] flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-[var(--color-gray-border)]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-gray-mid)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar notas..."
              className="w-full pl-8 pr-4 py-2 text-sm rounded-lg bg-[var(--color-gray-light)] border border-[var(--color-gray-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {/* Inbox */}
          <button
            onClick={() => setSelectedFolderId('inbox')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors mb-1 ${
              selectedFolderId === 'inbox'
                ? 'bg-[#67b31f1a] text-[var(--color-primary)] font-medium'
                : 'text-[var(--color-text-soft)] hover:bg-[var(--color-gray-light)]'
            }`}
          >
            <Inbox size={15} />
            <span className="flex-1 text-left">Inbox</span>
            <span className="text-xs text-[var(--color-gray-mid)]">
              {notes.filter((n) => !n.folder_id).length}
            </span>
          </button>

          {/* Folders */}
          <div className="mt-3">
            <div className="flex items-center justify-between px-3 mb-1">
              <span className="text-xs font-medium text-[var(--color-gray-mid)] uppercase tracking-wide">
                Carpetas
              </span>
              <button
                onClick={() => setShowNewFolder(true)}
                className="p-1 rounded text-[var(--color-gray-mid)] hover:text-[var(--color-primary)] hover:bg-[var(--color-gray-light)] transition-colors"
                aria-label="Nueva carpeta"
              >
                <Plus size={13} />
              </button>
            </div>

            {showNewFolder && (
              <div className="px-2 mb-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolder();
                    if (e.key === 'Escape') setShowNewFolder(false);
                  }}
                  autoFocus
                  placeholder="Nombre de carpeta"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-primary)] focus:outline-none bg-[var(--color-surface)]"
                />
              </div>
            )}

            {folders.map((folder) => (
              <div key={folder.id} className="group relative">
                <button
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedFolderId === folder.id
                      ? 'bg-[#67b31f1a] text-[var(--color-primary)] font-medium'
                      : 'text-[var(--color-text-soft)] hover:bg-[var(--color-gray-light)]'
                  }`}
                >
                  {selectedFolderId === folder.id ? (
                    <FolderOpen size={15} />
                  ) : (
                    <Folder size={15} />
                  )}
                  <span className="flex-1 text-left truncate">{folder.name}</span>
                  <span className="text-xs text-[var(--color-gray-mid)]">
                    {notes.filter((n) => n.folder_id === folder.id).length}
                  </span>
                </button>
                <button
                  onClick={() => handleDeleteFolder(folder.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 text-[var(--color-gray-mid)] hover:text-red-500 transition-all"
                  aria-label="Eliminar carpeta"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-[var(--color-gray-mid)] uppercase tracking-wide px-3 mb-2">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5 px-3">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      activeTagFilter === tag
                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                        : 'border-[var(--color-gray-border)] text-[var(--color-text-soft)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>
      </aside>

      {/* Notes list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[var(--color-surface)] border-b border-[var(--color-gray-border)]">
          <h2 className="font-semibold text-[var(--color-text)]">
            {selectedFolderId === 'inbox'
              ? 'Inbox'
              : folders.find((f) => f.id === selectedFolderId)?.name ?? 'Notas'}
          </h2>
          <button
            onClick={handleCreateNote}
            disabled={creatingNote}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-60 transition-colors"
          >
            <Plus size={16} />
            Nueva nota
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {visibleNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <FileText size={48} className="text-[var(--color-gray-border)] mb-3" />
              <p className="text-[var(--color-text-soft)]">
                {search ? 'Sin resultados para tu búsqueda' : 'No hay notas aquí todavía'}
              </p>
              {!search && (
                <button
                  onClick={handleCreateNote}
                  className="mt-3 text-sm text-[var(--color-primary)] hover:underline"
                >
                  Crear primera nota
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {visibleNotes.map((note) => (
                <NoteListItem
                  key={note.id}
                  note={note}
                  onDelete={handleDeleteNote}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NoteListItem({
  note,
  onDelete,
}: {
  note: Partial<Note>;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="bg-[var(--color-surface)] rounded-xl p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all hover:-translate-y-0.5 cursor-pointer relative group"
      onClick={() => router.push(`/notes/${note.id}`)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-[var(--color-text)] truncate">
            {note.title || 'Sin título'}
          </h3>
          {note.content_text && (
            <p className="text-sm text-[var(--color-text-soft)] mt-1 line-clamp-2">
              {note.content_text}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {note.tags && note.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {note.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded-full bg-[#67b31f1a] text-[var(--color-primary)]"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <span className="text-xs text-[var(--color-gray-mid)] ml-auto">
              {note.updated_at ? formatDate(note.updated_at) : ''}
            </span>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[var(--color-gray-light)] transition-all"
            aria-label="Opciones"
          >
            <MoreVertical size={15} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-36 bg-[var(--color-surface)] rounded-lg shadow-[var(--shadow-card)] border border-[var(--color-gray-border)] z-20 py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(note.id!);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 transition-colors"
                >
                  <Trash2 size={13} />
                  Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
