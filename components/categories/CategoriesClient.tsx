'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { Category } from '@/lib/types';
import { CategoryForm } from './CategoryForm';
import { CategoryList } from './CategoryList';

interface Props {
  initialCategories: Category[];
}

export function CategoriesClient({ initialCategories }: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [modalState, setModalState] = useState<
    | { open: false }
    | { open: true; editing: Category | undefined }
  >({ open: false });

  function openCreate() {
    setModalState({ open: true, editing: undefined });
  }

  function openEdit(cat: Category) {
    setModalState({ open: true, editing: cat });
  }

  function closeModal() {
    setModalState({ open: false });
  }

  function handleSaved(saved: Category) {
    setCategories((prev) => {
      const exists = prev.some((c) => c.id === saved.id);
      const updated = exists
        ? prev.map((c) => (c.id === saved.id ? saved : c))
        : [...prev, saved];
      return updated.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    });
    closeModal();
  }

  function handleDeleted(id: string) {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-[var(--color-gray-border)] flex items-center justify-between">
        <span className="text-sm text-[var(--color-text-soft)]">
          {categories.length} {categories.length === 1 ? 'categoría' : 'categorías'}
        </span>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-[#67b31f1a] transition-colors"
        >
          <Plus size={15} />
          Nueva categoría
        </button>
      </div>

      <CategoryList
        categories={categories}
        onEdit={openEdit}
        onDeleted={handleDeleted}
      />

      {/* Modal */}
      {modalState.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative z-10 bg-[var(--color-surface)] rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">
                {modalState.editing ? 'Editar categoría' : 'Nueva categoría'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 text-[var(--color-gray-mid)] hover:bg-[var(--color-gray-light)] rounded-lg transition-colors"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
            <CategoryForm
              category={modalState.editing}
              onSuccess={handleSaved}
              onCancel={closeModal}
            />
          </div>
        </div>
      )}
    </div>
  );
}
