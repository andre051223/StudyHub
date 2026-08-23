'use client';

import { useState } from 'react';
import { Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Category } from '@/lib/types';
import { deleteCategoryAction } from '@/app/(app)/categories/actions';
import { useConfirm } from '@/components/shared/ConfirmProvider';

interface Props {
  categories: Category[];
  onEdit: (category: Category) => void;
  onDeleted: (id: string) => void;
}

export function CategoryList({ categories, onEdit, onDeleted }: Props) {
  const confirm = useConfirm();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(cat: Category) {
    const ok = await confirm({
      title: '¿Eliminar la categoría?',
      message: `Las tareas y sesiones de «${cat.name}» quedarán sin categoría, pero no se borran.`,
    });
    if (!ok) return;

    setDeletingId(cat.id);
    const result = await deleteCategoryAction(cat.id);
    setDeletingId(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success('Categoría eliminada');
    onDeleted(cat.id);
  }

  if (categories.length === 0) {
    return (
      <div className="py-16 text-center text-[var(--color-text-soft)] text-sm">
        No tienes categorías. Crea una para organizar tus tareas y sesiones.
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--color-gray-border)]">
      {categories.map((cat) => (
        <div key={cat.id} className="px-5 py-4 flex items-center gap-3 group">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: cat.color }}
          />
          <span className="flex-1 text-sm font-medium text-[var(--color-text)]">
            {cat.name}
          </span>
          {/*
            Visibles siempre en pantallas táctiles (no hay hover que revele
            los botones) y, en escritorio, también cuando el foco entra en el
            grupo: con solo `group-hover` navegar con Tab enfocaba botones
            invisibles.
          */}
          <div className="flex gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <button
              onClick={() => onEdit(cat)}
              className="p-1.5 text-[var(--color-gray-mid)] hover:text-[var(--color-text)] hover:bg-[var(--color-gray-light)] rounded-lg transition-colors"
              aria-label={`Editar ${cat.name}`}
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => handleDelete(cat)}
              disabled={deletingId === cat.id}
              className="p-1.5 text-[var(--color-gray-mid)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/15 rounded-lg transition-colors disabled:opacity-40"
              aria-label={`Eliminar ${cat.name}`}
            >
              {deletingId === cat.id ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
