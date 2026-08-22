'use client';

import { useState } from 'react';
import { Clock, CheckCircle2, XCircle, ListChecks } from 'lucide-react';
import type { StudySession } from '@/lib/types';
import { localDayKey } from '@/lib/stats';
import { formatDateTime, formatTime } from '@/lib/utils';

interface Props {
  sessions: (StudySession & { category?: { name: string; color: string } | null })[];
}

export function SessionHistory({ sessions }: Props) {
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
        <p className="text-sm text-[var(--color-gray-mid)] mt-1">Inicia tu primera sesión de estudio.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="month"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="text-sm border border-[var(--color-gray-border)] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
        {uniqueCategories.length > 0 && (
          <select
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
                  Inicio: {formatDateTime(s.started_at)}
                </p>
              )}
              <p className="text-xs text-[var(--color-text-soft)]">
                {s.task && `${formatDateTime(s.started_at)} · `}
                Fin: {s.completed_at ? formatTime(s.completed_at) : 'En progreso'} ·{' '}
                {s.mode === 'stopwatch' ? 'Cronómetro' : s.mode === 'pomodoro' ? 'Pomodoro' : 'Temporizador'}
                {s.duration_minutes !== null && ` · ${s.duration_minutes} min planeados`}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
