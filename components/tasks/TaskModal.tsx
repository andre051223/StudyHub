'use client';

import { useState } from 'react';
import { X, Trash2, Plus, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Task, Subtask, TaskQuadrant, Category } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { addSubtaskAction } from '@/app/(app)/tasks/actions';
import { taskQuadrantSchema } from '@/lib/api/schemas';
import { formatMinutes } from '@/lib/stats';
import { Modal } from '@/components/shared/Modal';
import { toast } from 'sonner';

// El formulario valida lo mismo que el servidor: los cuadrantes salen del
// esquema compartido para que añadir uno nuevo no obligue a tocar dos sitios.
const schema = z.object({
  title: z.string().min(1, 'El título es requerido'),
  description: z.string().optional(),
  quadrant: taskQuadrantSchema,
  deadline: z.string().optional(),
  category_id: z.string().optional(),
  // Vacío = sin estimar. Se deja como texto y se convierte al enviar: un
  // `z.number()` sobre un input vacío da NaN y bloquea el formulario entero
  // por un campo que es opcional.
  estimated_minutes: z
    .string()
    .optional()
    .refine(
      (v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 5 && Number(v) <= 6000),
      'La estimación debe ser un número entero entre 5 y 6000 minutos.'
    ),
});

type FormData = z.infer<typeof schema>;

// Mismos colores que las columnas del Kanban: índigo en «Planificar», no el
// verde de marca. Ver la nota de QUADRANTS en TasksClient.tsx.
const QUADRANT_OPTIONS = [
  { value: 'urgent_important', label: 'Hacer ahora', color: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/15' },
  { value: 'not_urgent_important', label: 'Planificar', color: 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-500/15' },
  { value: 'urgent_not_important', label: 'Delegar', color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/15' },
  { value: 'not_urgent_not_important', label: 'Eliminar', color: 'text-gray-500 bg-gray-100 dark:text-[var(--color-text-soft)] dark:bg-white/10' },
];

interface Props {
  task: Task | null;
  defaultQuadrant: TaskQuadrant;
  categories: Category[];
  onSave: (data: Partial<Task>) => Promise<void>;
  /** Pide confirmación y cierra el modal por su cuenta si se elimina. */
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

export function TaskModal({ task, defaultQuadrant, categories, onSave, onDelete, onClose }: Props) {
  const supabase = createClient();
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks ?? []);
  const [newSubtask, setNewSubtask] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const studiedMinutes = Math.round((task?.studied_seconds ?? 0) / 60);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      quadrant: task?.quadrant ?? defaultQuadrant,
      deadline: task?.deadline ? task.deadline.slice(0, 10) : '',
      category_id: task?.category_id ?? '',
      estimated_minutes: task?.estimated_minutes != null ? String(task.estimated_minutes) : '',
    },
  });

  async function onSubmit(data: FormData) {
    setSaving(true);
    await onSave({
      id: task?.id,
      title: data.title,
      description: data.description || null,
      quadrant: data.quadrant,
      deadline: data.deadline || null,
      category_id: data.category_id || null,
      estimated_minutes: data.estimated_minutes ? Number(data.estimated_minutes) : null,
    });
    setSaving(false);
  }

  async function handleAddSubtask() {
    if (!newSubtask.trim() || !task?.id) return;
    // Por Server Action: TaskModel comprueba que la tarea sea del usuario antes
    // de colgarle una subtarea y calcula la posición dentro de la lista.
    const result = await addSubtaskAction(task.id, { title: newSubtask });
    if (!result.ok) { toast.error(result.error); return; }
    setSubtasks((prev) => [...prev, result.data]);
    setNewSubtask('');
  }

  async function handleToggleSubtask(id: string, completed: boolean) {
    setSubtasks((prev) => prev.map((s) => (s.id === id ? { ...s, completed } : s)));
    await supabase.from('subtasks').update({ completed }).eq('id', id);
  }

  async function handleDeleteSubtask(id: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
    await supabase.from('subtasks').delete().eq('id', id);
  }

  // La confirmación vive en el diálogo compartido (ConfirmProvider), no en una
  // confirmación en línea de dos pasos propia de esta pantalla.
  async function handleDelete() {
    if (!task?.id) return;
    setDeleting(true);
    await onDelete(task.id);
    setDeleting(false);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={task ? 'Editar tarea' : 'Nueva tarea'}
      dismissable={!saving && !deleting}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
            Título *
          </label>
          <input
            type="text"
            autoFocus
            placeholder="¿Qué necesitas hacer?"
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-gray-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
            {...register('title')}
          />
          {errors.title && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.title.message}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
            Descripción
          </label>
          <textarea
            rows={3}
            placeholder="Detalles opcionales..."
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-gray-border)] text-[var(--color-text)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
            {...register('description')}
          />
        </div>

        {/* Quadrant */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
            Cuadrante
          </label>
          <div className="grid grid-cols-2 gap-2">
            {QUADRANT_OPTIONS.map((opt) => (
              <label key={opt.value} className="cursor-pointer">
                <input type="radio" value={opt.value} className="peer sr-only" {...register('quadrant')} />
                <div
                  className={`px-3 py-2 rounded-lg text-xs font-medium text-center border-2 border-transparent transition-all peer-checked:border-current peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-primary)] ${opt.color}`}
                >
                  {opt.label}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Deadline + Category + estimación */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
              Fecha límite
            </label>
            <input
              type="date"
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-gray-border)] text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
              {...register('deadline')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
              Categoría
            </label>
            <select
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-gray-border)] text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
              {...register('category_id')}
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Estimación (migración 009). Sin ella, el tiempo dedicado que
            muestra la tarjeta es un dato sin veredicto: no distingue «me
            cundió» de «se me fue el doble». */}
        <div>
          <label
            htmlFor="task-estimate"
            className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
          >
            Tiempo estimado (min)
          </label>
          <input
            id="task-estimate"
            type="number"
            min={5}
            max={6000}
            placeholder="Opcional — p. ej. 90"
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-gray-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
            {...register('estimated_minutes')}
          />
          {errors.estimated_minutes && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">
              {errors.estimated_minutes.message}
            </p>
          )}
          {studiedMinutes > 0 && (
            <p className="text-meta mt-1.5">
              Llevas {formatMinutes(studiedMinutes)} estudiados en esta tarea.
            </p>
          )}
        </div>

        {/* Subtasks (only when editing) */}
        {task && (
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
              Subtareas
            </label>
            <div className="space-y-2 mb-2">
              {subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={s.completed}
                    onChange={(e) => handleToggleSubtask(s.id, e.target.checked)}
                    className="accent-[var(--color-primary)]"
                  />
                  <span className={`flex-1 text-sm ${s.completed ? 'line-through text-[var(--color-gray-mid)]' : 'text-[var(--color-text)]'}`}>
                    {s.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteSubtask(s.id)}
                    aria-label={`Eliminar subtarea ${s.title}`}
                    className="p-1 text-[var(--color-gray-mid)] hover:text-red-500 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())}
                placeholder="Agregar subtarea..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--color-gray-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                aria-label="Agregar subtarea"
                className="px-3 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 pt-2">
          {task ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15 rounded-lg transition-colors disabled:opacity-60"
            >
              {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              Eliminar
            </button>
          ) : (
            <span />
          )}

          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-[var(--color-gray-border)] rounded-lg hover:bg-[var(--color-gray-light)] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-60 transition-colors"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Guardar
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
