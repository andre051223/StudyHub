'use client';

import { useState } from 'react';
import { Clock, CheckCircle2, XCircle, ListChecks, Pencil, PenLine, Plus } from 'lucide-react';
import type { StudySession, StudyMode } from '@/lib/types';
import { localDayKey, type FocusRatingKey } from '@/lib/stats';
import { LocalTimestamp } from '@/components/shared/LocalTimestamp';
import { FocusChip } from './focusRating';

/** Cómo se llama cada modo en el historial. */
const MODE_LABELS: Record<StudyMode, string> = {
  simple: 'Temporizador',
  stopwatch: 'Cronómetro',
  pomodoro: 'Pomodoro',
  manual: 'Registro manual',
};

interface Props {
  sessions: (StudySession & { category?: { name: string; color: string } | null })[];
  /** Abre el formulario de alta manual. */
  onCreate: () => void;
  /** Abre el formulario de corrección para una sesión existente. */
  onEdit: (session: StudySession) => void;
}

export function SessionHistory({ sessions, onCreate, onEdit }: Props) {
  const [dateFilter, setDateFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const filtered = sessions.filter((s) => {
    if (dateFilter) {
      // Por día local: con toISOString() una sesión nocturna se filtraba como
      // del mes siguiente en los últimos días del mes.
      if (!localDayKey(s.started_at).startsWith(dateFilter)) return false;
    }
    if (categoryFilter && s.category?.name !== categoryFilter) return false;
    return true;
  });

  const uniqueCategories = Array.from(
    new Map(sessions.filter((s) => s.category).map((s) => [s.category_id, s.category])).values()
  );

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Clock size={48} className="text-[var(--color-gray-border)] mb-3" />
        <p className="text-[var(--color-text-soft)]">Sin sesiones registradas todavía.</p>
        <p className="text-sm text-[var(--color-gray-mid)] mt-1">
          Inicia tu primera sesión de estudio, o registra a mano la que ya hiciste.
        </p>
        <button
          onClick={onCreate}
          className="flex items-center gap-1.5 mt-4 px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          <Plus size={15} />
          Registrar sesión
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="month"
          aria-label="Filtrar por mes"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="text-sm border border-[var(--color-gray-border)] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
        {uniqueCategories.length > 0 && (
          <select
            aria-label="Filtrar por categoría"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-sm border border-[var(--color-gray-border)] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <option value="">Todas las categorías</option>
            {uniqueCategories.map((c) => (
              <option key={c?.name} value={c?.name}>{c?.name}</option>
            ))}
          </select>
        )}

        {/* El alta manual vive junto a los filtros y no en la cabecera de la
            pantalla: es una acción sobre el historial, no sobre el reloj. */}
        <button
          onClick={onCreate}
          className="flex items-center gap-1.5 ml-auto px-3 py-1.5 text-sm font-medium border border-[var(--color-gray-border)] text-[var(--color-text-soft)] rounded-lg hover:bg-[var(--color-gray-light)] hover:text-[var(--color-text)] transition-colors"
        >
          <Plus size={15} />
          Registrar sesión
        </button>
      </div>

      <div className="space-y-2">
        {filtered.slice(0, 20).map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-4 px-4 py-3 rounded-xl border border-[var(--color-gray-border)] hover:bg-[var(--color-gray-light)] transition-colors"
          >
            {s.completed_at ? (
              <CheckCircle2 size={18} className="text-[var(--color-primary)] flex-shrink-0" />
            ) : (
              <XCircle size={18} className="text-[var(--color-gray-mid)] flex-shrink-0" />
            )}

            <div className="flex-1 min-w-0">
              {/* Si la sesión se estudió sobre una tarea, ese es el titular:
                  "parcial de Cálculo" dice más que una marca de tiempo. */}
              {s.task ? (
                <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text)] truncate">
                  <ListChecks size={13} className="text-[var(--color-gray-mid)] flex-shrink-0" />
                  {s.task.title}
                </p>
              ) : (
                <p className="text-sm font-medium text-[var(--color-text)]">
                  Inicio: <LocalTimestamp value={s.started_at} />
                </p>
              )}
              <p className="text-xs text-[var(--color-text-soft)]">
                {s.task && (
                  <>
                    <LocalTimestamp value={s.started_at} /> ·{' '}
                  </>
                )}
                Fin:{' '}
                {s.completed_at ? (
                  <LocalTimestamp value={s.completed_at} format="time" />
                ) : (
                  'En progreso'
                )}{' '}
                ·{' '}
                <span className="inline-flex items-center gap-1">
                  {s.mode === 'manual' && <PenLine size={11} aria-hidden />}
                  {MODE_LABELS[s.mode] ?? s.mode}
                </span>
                {s.duration_minutes !== null && ` · ${s.duration_minutes} min planeados`}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {s.focus_rating && <FocusChip rating={s.focus_rating as FocusRatingKey} />}
              {s.category && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: s.category.color + '22',
                    color: s.category.color,
                  }}
                >
                  {s.category.name}
                </span>
              )}
              <span className="text-sm font-semibold text-[var(--color-text)]">
                {Math.round(s.actual_duration_seconds / 60)} min
              </span>
              {/* Corregir o borrar. Sin esto, olvidarse de detener el
                  cronómetro dejaba para siempre una sesión que falsea la
                  racha, el promedio y el tiempo dedicado a la tarea. */}
              <button
                onClick={() => onEdit(s)}
                aria-label="Editar o eliminar esta sesión"
                title="Editar o eliminar"
                className="p-1.5 rounded-lg text-[var(--color-gray-mid)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] transition-colors"
              >
                <Pencil size={14} />
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-sm text-[var(--color-text-soft)] py-8 text-center">
            Ninguna sesión coincide con los filtros.
          </p>
        )}
      </div>
    </div>
  );
}
