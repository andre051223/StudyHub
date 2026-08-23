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
import { useLocalToday } from '@/hooks/useLocalToday';

interface Props {
  sessions: StatsSession[];
  dailyGoal: number;
}

/** Lo que se pinta mientras el navegador no ha dicho aún en qué día está. */
const PENDING = '—';

/**
 * La franja «hoy» del dashboard: meta diaria, racha y semana.
 *
 * Todo `lib/stats.ts` agrupa por el día natural del usuario usando los getters
 * locales, y durante el render de servidor «local» es la zona del servidor
 * (UTC en Vercel): calculado allí, un repaso de las 20:00 en Colombia contaría
 * como estudio de mañana y la racha se rompería sola.
 *
 * Marcar el componente como de cliente **no** basta: un componente de cliente
 * también se renderiza en el servidor. Por eso el día lo aporta
 * `useLocalToday()`, que devuelve null hasta que hay navegador; hasta entonces
 * se pinta la estructura con los huecos vacíos, sin inventar números.
 */
export function TodayStats({ sessions, dailyGoal }: Props) {
  const todayMs = useLocalToday();

  const data = useMemo(() => {
    if (todayMs === null) return null;
    const now = new Date(todayMs);
    const completed = onlyCompleted(sessions);
    return {
      summary: summarize(completed, now),
      week: dailyBuckets(completed, 7, now),
    };
  }, [sessions, todayMs]);

  const goalPct = data ? Math.min(100, Math.round((data.summary.minutesToday / dailyGoal) * 100)) : 0;
  const remaining = data ? Math.max(0, dailyGoal - data.summary.minutesToday) : 0;
  const week = data?.week ?? [];
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
          {data ? formatMinutes(data.summary.minutesToday) : PENDING}
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

        {/* La altura se reserva siempre para que la tarjeta no dé un salto
            cuando llega el dato del navegador. */}
        <p className="text-meta mt-2 min-h-[1.1em]">
          {!data ? '' : remaining === 0 ? '¡Meta cumplida!' : `Faltan ${formatMinutes(remaining)}`}
        </p>
      </section>

      {/* Racha */}
      <section className="bg-[var(--color-surface)] rounded-xl p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2 mb-3">
          <Flame size={14} className="text-[var(--color-gray-mid)]" />
          <h2 className="text-eyebrow">Racha</h2>
        </div>

        <p className="text-3xl font-bold text-orange-500 dark:text-orange-400 tabular-nums">
          {data ? data.summary.currentStreak : PENDING}
          <span className="text-base font-medium text-[var(--color-gray-mid)]">
            {' '}
            {data && data.summary.currentStreak === 1 ? 'día' : 'días'}
          </span>
        </p>

        <p className="text-meta mt-3 min-h-[1.1em]">
          {!data
            ? ''
            : data.summary.currentStreak === 0
            ? 'Estudia hoy para empezar una.'
            : data.summary.minutesToday > 0
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
          {data ? formatMinutes(data.summary.minutesThisWeek) : PENDING}
        </p>

        {/* Barras diarias: los huecos son información, así que se pintan.
            El `title` solo se añade cuando ya hay día local; añadirlo antes
            volvería a meter una fecha formateada en el HTML del servidor. */}
        <div className="mt-3 flex items-end gap-1 h-8" aria-hidden>
          {data
            ? week.map((day) => (
                <div
                  key={day.key}
                  title={`${day.date.toLocaleDateString('es-CO', { weekday: 'short' })}: ${
                    day.minutes
                  } min`}
                  className="flex-1 rounded-sm bg-[var(--color-primary)]/25 min-h-[2px]"
                  style={{ height: `${Math.max(4, (day.minutes / peak) * 100)}%` }}
                />
              ))
            : Array.from({ length: 7 }, (_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-[var(--color-primary)]/25 min-h-[2px]"
                  style={{ height: '4%' }}
                />
              ))}
        </div>

        <p className="text-meta mt-2 min-h-[1.1em]">
          {data ? `Promedio de ${formatMinutes(data.summary.dailyAverage)} al día` : ''}
        </p>
      </section>
    </div>
  );
}
