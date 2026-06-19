'use client';

import { useState, useEffect } from 'react';
import { X, Trash2, Plus, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Task, Subtask, TaskQuadrant, Category } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const schema = z.object({
  title: z.string().min(1, 'El título es requerido'),
  description: z.string().optional(),
  quadrant: z.enum([
    'urgent_important',
    'not_urgent_important',
    'urgent_not_important',
    'not_urgent_not_important',
  ]),
  deadline: z.string().optional(),
  category_id: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const QUADRANT_OPTIONS = [
  { value: 'urgent_important', label: 'Hacer ahora', color: 'text-red-600 bg-red-50' },
  { value: 'not_urgent_important', label: 'Planificar', color: 'text-[#67b31f] bg-[#67b31f1a]' },
  { value: 'urgent_not_important', label: 'Delegar', color: 'text-yellow-600 bg-yellow-50' },
  { value: 'not_urgent_not_important', label: 'Eliminar', color: 'text-gray-500 bg-gray-100' },
];

interface Props {
  task: Task | null;
  defaultQuadrant: TaskQuadrant;
  categories: Category[];
  onSave: (data: Partial<Task>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

export function TaskModal({ task, defaultQuadrant, categories, onSave, onDelete, onClose }: Props) {
  const supabase = createClient();
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks ?? []);
  const [newSubtask, setNewSubtask] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      quadrant: task?.quadrant ?? defaultQuadrant,
      deadline: task?.deadline ? task.deadline.slice(0, 10) : '',
      category_id: task?.category_id ?? '',
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
    });
    setSaving(false);
  }

  async function handleAddSubtask() {
    if (!newSubtask.trim() || !task?.id) return;
    const { data, error } = await supabase
      .from('subtasks')
      .insert({ task_id: task.id, title: newSubtask.trim(), position: subtasks.length })
      .select()
      .single();
    if (error) { toast.error('Error al agregar subtarea'); return; }
    setSubtasks((prev) => [...prev, data]);
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

  async function handleDelete() {
    if (!task?.id) return;
    setDeleting(true);
    await onDelete(task.id);
    setDeleting(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-[var(--color-surface)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-gray-border)]">
          <h2 className="font-semibold text-[var(--color-text)]">
            {task ? 'Editar tarea' : 'Nueva tarea'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--color-gray-light)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
              Título *
            </label>
            <input
              type="text"
              placeholder="¿Qué necesitas hacer?"
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-gray-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
              {...register('title')}
            />
            {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
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
                  <input type="radio" value={opt.value} className="sr-only" {...register('quadrant')} />
                  <div className={`px-3 py-2 rounded-lg text-xs font-medium text-center border-2 transition-all ${opt.color} border-transparent`}>
                    {opt.label}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Deadline + Category row */}
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
                  className="px-3 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            {task && !showDeleteConfirm && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={15} />
                Eliminar
              </button>
            )}
            {showDeleteConfirm && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">¿Confirmar?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {deleting ? <Loader2 size={12} className="animate-spin" /> : 'Sí, eliminar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-xs border border-[var(--color-gray-border)] rounded-lg hover:bg-[var(--color-gray-light)] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}
            {!task && <span />}
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
      </div>
    </div>
  );
}
