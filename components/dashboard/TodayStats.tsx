'use client';

import { useMemo } from 'react';
import { Flame, Target, TrendingUp } from 'lucide-react';
import {
  dailyBuckets,
  formatMinutes,
  onlyCompleted,
  summarize,
  type StatsSession,
} from '@/lib/stats';

interface Props {
  sessions: StatsSession[];
  dailyGoal: number;
}

/**
 * La franja «hoy» del dashboard: meta diaria, racha y semana.
 *
 * Es un componente de cliente a propósito, aunque no tenga estado. Todo
 * `lib/stats.ts` agrupa por el día natural del usuario usando los getters
 * locales, y en el servidor «local» es la zona del servidor (UTC en Vercel):
 * calculado allí, un repaso de las 20:00 en Colombia contaría como estudio de
 * mañana y la racha se rompería sola. En el navegador la zona es la correcta.
 */
export function TodayStats({ sessions, dailyGoal }: Props) {
  const { summary, week } = useMemo(() => {
    const completed = onlyCompleted(sessions);
    return {
      summary: summarize(completed),
      week: dailyBuckets(completed, 7),
    };
  }, [sessions]);

  const goalPct = Math.min(100, Math.round((summary.minutesToday / dailyGoal) * 100));
  const remaining = Math.max(0, dailyGoal - summary.minutesToday);
  const peak = Math.max(...week.map((d) => d.minutes), 1);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Meta diaria */}
      <section className="bg-[var(--color-surface)] rounded-xl p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2 mb-3">
          <Target size={14} className="text-[var(--color-gray-mid)]" />
          <h2 className="text-eyebrow">Meta de hoy</h2>
        </div>

        <p className="text-3xl font-bold text-[var(--color-text)] tabular-nums">
          {formatMinutes(summary.minutesToday)}
          <span className="text-base font-medium text-[var(--color-gray-mid)]">
            {' '}/ {formatMinutes(dailyGoal)}
          </span>
        </p>

        <div
          className="mt-3 h-2 rounded-full bg-[var(--color-gray-light)] overflow-hidden"
          role="progressbar"
          aria-valuenow={goalPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progreso de la meta diaria"
        >
          <div
            className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-500"
            style={{ width: `${goalPct}%` }}
          />
        </div>

        <p className="text-meta mt-2">
          {remaining === 0
            ? '¡Meta cumplida!'
            : `Faltan ${formatMinutes(remaining)}`}
        </p>
      </section>

      {/* Racha */}
      <section className="bg-[var(--color-surface)] rounded-xl p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2 mb-3">
          <Flame size={14} className="text-[var(--color-gray-mid)]" />
          <h2 className="text-eyebrow">Racha</h2>
        </div>

        <p className="text-3xl font-bold text-orange-500 tabular-nums">
          {summary.currentStreak}
          <span className="text-base font-medium text-[var(--color-gray-mid)]">
            {' '}{summary.currentStreak === 1 ? 'día' : 'días'}
          </span>
        </p>

        <p className="text-meta mt-3">
          {summary.currentStreak === 0
            ? 'Estudia hoy para empezar una.'
            : summary.minutesToday > 0
            ? 'Hoy ya cuenta. Sigue así.'
            : 'Estudia hoy para no perderla.'}
        </p>
      </section>

      {/* Semana */}
      <section className="bg-[var(--color-surface)] rounded-xl p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} className="text-[var(--color-gray-mid)]" />
          <h2 className="text-eyebrow">Últimos 7 días</h2>
        </div>

        <p className="text-3xl font-bold text-[var(--color-text)] tabular-nums">
          {formatMinutes(summary.minutesThisWeek)}
        </p>

        {/* Barras diarias: los huecos son información, así que se pintan. */}
        <div className="mt-3 flex items-end gap-1 h-8" aria-hidden>
          {week.map((day) => (
            <div
              key={day.key}
              title={`${day.date.toLocaleDateString('es-CO', { weekday: 'short' })}: ${day.minutes} min`}
              className="flex-1 rounded-sm bg-[var(--color-primary)]/25 min-h-[2px]"
              style={{ height: `${Math.max(4, (day.minutes / peak) * 100)}%` }}
            />
          ))}
        </div>

        <p className="text-meta mt-2">
          Promedio de {formatMinutes(summary.dailyAverage)} al día
        </p>
      </section>
    </div>
  );
}
