'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Category } from '@/lib/types';
import { createCategorySchema } from '@/lib/api/schemas';
import { createCategoryAction, updateCategoryAction } from '@/app/(app)/categories/actions';

// El mismo esquema que valida la Server Action. Antes había aquí una copia sin
// `.trim()`, así que "  Mate  " pasaba el formulario y el servidor lo guardaba
// recortado —el usuario veía un nombre distinto al que escribió— y "  a  "
// pasaba el min(2) del cliente para fallar después en el servidor.
type FormValues = z.infer<typeof createCategorySchema>;

const PRESET_COLORS = [
  '#67b31f', '#3b82f6', '#f97316', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b',
  '#6366f1', '#10b981', '#64748b', '#dc2626',
];

interface Props {
  category?: Category;
  onSuccess: (category: Category) => void;
  onCancel: () => void;
}

export function CategoryForm({ category, onSuccess, onCancel }: Props) {
  const isEditing = !!category;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: {
      name: category?.name ?? '',
      color: category?.color ?? '#67b31f',
    },
  });

  const selectedColor = watch('color');

  async function onSubmit(values: FormValues) {
    const result = isEditing
      ? await updateCategoryAction(category.id, values)
      : await createCategoryAction(values);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(isEditing ? 'Categoría actualizada' : 'Categoría creada');
    onSuccess(result.data);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name field */}
      <div>
        <label
          htmlFor="cat-name"
          className="block text-sm font-medium text-[var(--color-text)] mb-1"
        >
          Nombre <span className="text-red-500">*</span>
        </label>
        <input
          id="cat-name"
          type="text"
          placeholder="Ej. Matemáticas, Programación…"
          autoFocus
          {...register('name')}
          className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-gray-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-[var(--color-text)] text-sm"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
        )}
      </div>

      {/* Color picker */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
          Color
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setValue('color', c, { shouldValidate: true })}
              className={`w-7 h-7 rounded-full transition-transform ${
                selectedColor === c
                  ? 'scale-125 ring-2 ring-offset-1 ring-[var(--color-text)]'
                  : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
          <input
            type="color"
            value={selectedColor}
            onChange={(e) => setValue('color', e.target.value, { shouldValidate: true })}
            className="w-7 h-7 rounded cursor-pointer border border-[var(--color-gray-border)]"
            title="Color personalizado"
          />
        </div>
        {errors.color && (
          <p className="mt-1 text-xs text-red-500">{errors.color.message}</p>
        )}
      </div>

      {/* Preview */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-gray-light)]">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: selectedColor }}
        />
        <span className="text-sm text-[var(--color-text-soft)]">
          {watch('name') || 'Vista previa'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm text-[var(--color-gray-mid)] border border-[var(--color-gray-border)] rounded-lg hover:bg-[var(--color-gray-light)] transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-60 transition-colors flex items-center gap-2"
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          {isEditing ? 'Guardar cambios' : 'Crear categoría'}
        </button>
      </div>
    </form>
  );
}
