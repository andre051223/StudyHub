'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Category } from '@/lib/types';
import { Modal } from '@/components/shared/Modal';
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

      {/* Modal compartido: el mismo <dialog> accesible que usa TaskModal. */}
      {modalState.open && (
        <Modal
          open
          onClose={closeModal}
          size="md"
          title={modalState.editing ? 'Editar categoría' : 'Nueva categoría'}
        >
          <div className="p-6">
            <CategoryForm
              category={modalState.editing}
              onSuccess={handleSaved}
              onCancel={closeModal}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
