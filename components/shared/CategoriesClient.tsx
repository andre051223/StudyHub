'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Category } from '@/lib/types';

const PRESET_COLORS = [
  '#67b31f', '#3b82f6', '#f97316', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b',
  '#6366f1', '#10b981', '#64748b', '#dc2626',
];

interface Props {
  initialCategories: Category[];
}

export function CategoriesClient({ initialCategories }: Props) {
  const supabase = createClient();
  const [categories, setCategories] = useState(initialCategories);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#67b31f');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [showForm, setShowForm] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('categories')
      .insert({ name: newName.trim(), color: newColor })
      .select()
      .single();
    setCreating(false);
    if (error) { toast.error('Error al crear categoría'); return; }
    setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewName('');
    setNewColor('#67b31f');
    setShowForm(false);
    toast.success('Categoría creada');
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return;
    const { data, error } = await supabase
      .from('categories')
      .update({ name: editName.trim(), color: editColor })
      .eq('id', id)
      .select()
      .single();
    if (error) { toast.error('Error al actualizar'); return; }
    setCategories((prev) => prev.map((c) => (c.id === id ? data : c)).sort((a, b) => a.name.localeCompare(b.name)));
    setEditingId(null);
    toast.success('Categoría actualizada');
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta categoría? Las tareas y sesiones asociadas quedarán sin categoría.')) return;
    await supabase.from('categories').delete().eq('id', id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    toast.success('Categoría eliminada');
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
      {/* New category form */}
      <div className="p-5 border-b border-[var(--color-gray-border)]">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-[#67b31f1a] transition-colors"
          >
            <Plus size={16} />
            Nueva categoría
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Nombre de la categoría"
                autoFocus
                className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--color-gray-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-text)]"
              />
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-60 transition-colors"
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-3 py-2.5 border border-[var(--color-gray-border)] rounded-lg hover:bg-[var(--color-gray-light)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <ColorPicker value={newColor} onChange={setNewColor} />
          </div>
        )}
      </div>

      {/* List */}
      {categories.length === 0 ? (
        <div className="py-12 text-center text-[var(--color-text-soft)]">
          No tienes categorías todavía.
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-gray-border)]">
          {categories.map((cat) => (
            <div key={cat.id} className="px-5 py-3.5">
              {editingId === cat.id ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdate(cat.id)}
                      autoFocus
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--color-gray-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                    <button onClick={() => handleUpdate(cat.id)} className="p-2 text-[var(--color-primary)] hover:bg-[#67b31f1a] rounded-lg transition-colors">
                      <Check size={15} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-2 text-[var(--color-gray-mid)] hover:bg-[var(--color-gray-light)] rounded-lg transition-colors">
                      <X size={15} />
                    </button>
                  </div>
                  <ColorPicker value={editColor} onChange={setEditColor} />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="flex-1 text-sm font-medium text-[var(--color-text)]">{cat.name}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditColor(cat.color); }}
                      className="p-1.5 text-[var(--color-gray-mid)] hover:text-[var(--color-text)] hover:bg-[var(--color-gray-light)] rounded-lg transition-colors"
                      aria-label="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      className="p-1.5 text-[var(--color-gray-mid)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/15 rounded-lg transition-colors"
                      aria-label="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {['#67b31f', '#3b82f6', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1', '#10b981', '#64748b', '#dc2626'].map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full transition-transform ${value === c ? 'scale-125 ring-2 ring-offset-1 ring-[var(--color-text)]' : 'hover:scale-110'}`}
          style={{ backgroundColor: c }}
          aria-label={c}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded cursor-pointer border border-[var(--color-gray-border)]"
        title="Color personalizado"
      />
    </div>
  );
}
