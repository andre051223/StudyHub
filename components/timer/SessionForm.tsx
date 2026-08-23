'use client';

import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Modal } from '@/components/shared/Modal';
import { useConfirm } from '@/components/shared/ConfirmProvider';
import {
  createSessionAction,
  updateSessionAction,
  deleteSessionAction,
} from '@/app/(app)/timer/actions';
import type { Category, OpenTask, StudySession } from '@/lib/types';
import type { FocusRatingKey } from '@/lib/stats';
import { FocusRatingPicker } from './focusRating';

/**
 * Alta manual y corrección de sesiones.
 *
 * Cubre los dos agujeros que dejaba el temporizador: el estudio hecho sin la
 * app —sin lo cual el historial no mide lo estudiado, sino las veces que uno
 * se acordó de abrir StudyHub— y la sesión inflada por olvidarse de detener el
 * cronómetro, que hasta ahora falseaba la racha y el promedio para siempre.
 *
 * Es un solo formulario para las dos cosas porque los campos son idénticos;
 * lo único que cambia es a qué acción se envían.
 */

const MAX_MINUTES = 24 * 60;

const schema = z.object({
  started_at: z.string().min(1, 'Indica cuándo empezaste.'),
  minutes: z.coerce
    .number()
    .int('Usa minutos enteros.')
    .min(1, 'La sesión debe durar al menos 1 minuto.')
    .max(MAX_MINUTES, 'Una sesión no puede durar más de 24 horas.'),
  category_id: z.string().optional(),
  task_id: z.string().optional(),
  notes: z.string().max(2000, 'Las notas no pueden superar los 2000 caracteres.').optional(),
});

type FormData = z.input<typeof schema>;

/**
 * `datetime-local` habla en hora local sin zona. `toISOString()` no sirve para
 * rellenarlo: convierte a UTC y en UTC−5 mostraría la sesión cinco horas más
 * tarde de lo que ocurrió.
 */
function toLocalInput(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/**
 * Fuera del componente a propósito: `Date.now()` es impuro y el compilador de
 * React marca como error cualquier llamada que pueda ocurrir durante el
 * render, aunque aquí solo la haga el submit.
 */
function isInTheFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}

interface Props {
  /** null = alta manual. */
  session: StudySession | null;
  categories: Category[];
  tasks: OpenTask[];
  onClose: () => void;
  onSaved: (session: StudySession) => void;
  onDeleted: (id: string) => void;
}

export function SessionForm({
  session,
  categories,
  tasks,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const confirm = useConfirm();
  const isEditing = session !== null;

  const [rating, setRating] = useState<FocusRatingKey | null>(
    (session?.focus_rating as FocusRatingKey | null) ?? null
  );
  // Una sesión abandonada sigue siéndolo al editarla; el alta manual, en
  // cambio, describe algo que ya ocurrió y por tanto nace completada.
  const [completed, setCompleted] = useState(isEditing ? session.completed_at !== null : true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      started_at: toLocalInput(session?.started_at ?? new Date()),
      minutes: session ? Math.max(1, Math.round(session.actual_duration_seconds / 60)) : 30,
      category_id: session?.category_id ?? '',
      task_id: session?.task_id ?? '',
      notes: session?.notes ?? '',
    },
  });

  async function onSubmit(raw: FormData) {
    const data = schema.parse(raw);
    const startedAt = new Date(data.started_at);
    if (Number.isNaN(startedAt.getTime())) {
      toast.error('La fecha de inicio no es válida.');
      return;
    }
    if (isInTheFuture(startedAt)) {
      toast.error('No puedes registrar una sesión que aún no ha ocurrido.');
      return;
    }

    const seconds = data.minutes * 60;
    const completedAt = completed
      ? new Date(startedAt.getTime() + seconds * 1000).toISOString()
      : null;

    setSaving(true);
    const payload = {
      category_id: data.category_id || null,
      task_id: data.task_id || null,
      actual_duration_seconds: seconds,
      started_at: startedAt.toISOString(),
      completed_at: completedAt,
      notes: data.notes?.trim() || null,
      focus_rating: rating,
    };

    const result = isEditing
      ? await updateSessionAction(session.id, payload)
      : await createSessionAction({
          ...payload,
          // Sin plan: no hubo temporizador que planear. Ver `PLANNED_RANGE`.
          duration_minutes: null,
          mode: 'manual' as const,
        });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onSaved(result.data);
    toast.success(isEditing ? 'Sesión actualizada' : 'Sesión registrada');
    onClose();
  }

  async function handleDelete() {
    if (!session) return;
    const confirmed = await confirm({
      title: '¿Eliminar esta sesión?',
      message:
        'El tiempo dejará de contar en tus estadísticas, tu racha y el tiempo dedicado a la tarea.',
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;

    setDeleting(true);
    const result = await deleteSessionAction(session.id);
    setDeleting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onDeleted(session.id);
    toast.success('Sesión eliminada');
    onClose();
  }

  const busy = saving || deleting;
  const inputClass =
    'w-full px-3 py-2.5 rounded-lg border border-[var(--color-gray-border)] text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all';

  return (
    <Modal
      open
      onClose={onClose}
      title={isEditing ? 'Editar sesión' : 'Registrar sesión'}
      description={
        isEditing
          ? undefined
          : 'Para el estudio que hiciste sin el temporizador. Quedará marcado como registro manual.'
      }
      dismissable={!busy}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="session-started"
              className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
            >
              Inicio *
            </label>
            <input
              id="session-started"
              type="datetime-local"
              className={inputClass}
              {...register('started_at')}
            />
            {errors.started_at && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                {errors.started_at.message}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="session-minutes"
              className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
            >
              Duración (min) *
            </label>
            <input
              id="session-minutes"
              type="number"
              min={1}
              max={MAX_MINUTES}
              className={inputClass}
              {...register('minutes')}
            />
            {errors.minutes && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                {errors.minutes.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="session-category"
              className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
            >
              Categoría
            </label>
            <select id="session-category" className={inputClass} {...register('category_id')}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="session-task"
              className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
            >
              Tarea
            </label>
            <select id="session-task" className={inputClass} {...register('task_id')}>
              <option value="">Sin tarea concreta</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
              {/* La tarea de una sesión antigua puede estar ya completada y
                  fuera de la lista de pendientes; sin esta opción, editar
                  cualquier otro campo la desligaría en silencio. */}
              {session?.task && !tasks.some((t) => t.id === session.task?.id) && (
                <option value={session.task.id}>{session.task.title}</option>
              )}
            </select>
          </div>
        </div>

        <div>
          <span className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
            ¿Cómo fue?
          </span>
          <FocusRatingPicker value={rating} onChange={setRating} disabled={busy} />
        </div>

        <div>
          <label
            htmlFor="session-notes"
            className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
          >
            Notas
          </label>
          <textarea
            id="session-notes"
            rows={2}
            placeholder="Qué repasaste, qué quedó pendiente…"
            className={`${inputClass} resize-none`}
            {...register('notes')}
          />
          {errors.notes && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.notes.message}</p>
          )}
        </div>

        {isEditing && (
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={completed}
              onChange={(e) => setCompleted(e.target.checked)}
              className="accent-[var(--color-primary)]"
            />
            Sesión completada
            <span className="text-meta">— las abandonadas no cuentan en las estadísticas.</span>
          </label>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          {isEditing ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
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
              disabled={busy}
              className="px-4 py-2 text-sm border border-[var(--color-gray-border)] rounded-lg hover:bg-[var(--color-gray-light)] transition-colors disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
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
