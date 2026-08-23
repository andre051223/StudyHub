'use client';

import { useMemo } from 'react';
import { Sunrise, Sparkles } from 'lucide-react';
import {
  bestHourBlock,
  focusTotals,
  formatMinutes,
  hourBlocks,
  type StatsSession,
} from '@/lib/stats';
import { FOCUS_META } from './focusRating';

/**
 * A qué hora se estudia, y cómo se estudia.
 *
 * Las dos preguntas van juntas en un panel porque se responden la una a la
 * otra: saber que acumulas más horas por la noche solo sirve si además sabes
 * si esas horas fueron aprovechadas. Ambas salen de datos que ya estaban en la
 * base —la hora de inicio desde el primer día, la calificación desde la
 * migración 009— y que hasta ahora no leía nadie.
 */

interface Props {
  /** Sesiones ya filtradas a completadas por el componente padre. */
  sessions: StatsSession[];
}

export function StudyPatterns({ sessions }: Props) {
  const { blocks, best, maxMinutes, focus } = useMemo(() => {
    const blocks = hourBlocks(sessions);
    return {
      blocks,
      best: bestHourBlock(sessions),
      maxMinutes: blocks.reduce((m, b) => Math.max(m, b.minutes), 0),
      focus: focusTotals(sessions),
    };
  }, [sessions]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ── Franja horaria ─────────────────────────────────── */}
      <section>
        <h3 className="heading-section text-[var(--color-text)] mb-3">Tu franja de estudio</h3>

        <p className="flex items-start gap-2 text-sm text-[var(--color-text-soft)] mb-3">
          <Sunrise size={15} className="text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
          {best ? (
            <span>
              Acumulas más tiempo entre las{' '}
              <strong className="text-[var(--color-text)]">
                {String(best.startHour).padStart(2, '0')}:00
              </strong>{' '}
              y las{' '}
              <strong className="text-[var(--color-text)]">
                {String(best.endHour % 24).padStart(2, '0')}:00
              </strong>{' '}
              — {formatMinutes(best.minutes)} en el último año.
            </span>
          ) : (
            <span>
              Con unas pocas sesiones más podremos decirte a qué hora sueles estudiar.
            </span>
          )}
        </p>

        <ul className="space-y-1.5">
          {blocks.map((block) => (
            <li key={block.startHour} className="flex items-center gap-2 text-xs">
              <span className="w-[92px] flex-shrink-0 tabular-nums text-[var(--color-text-soft)]">
                {block.label}
              </span>
              <span className="flex-1 h-2 rounded-full bg-[var(--color-gray-border)] overflow-hidden">
                <span
                  className="block h-full rounded-full transition-all"
                  style={{
                    width: maxMinutes > 0 ? `${(block.minutes / maxMinutes) * 100}%` : '0%',
                    background:
                      best?.startHour === block.startHour
                        ? 'var(--color-primary)'
                        : 'var(--color-gray-mid)',
                  }}
                />
              </span>
              <span className="w-16 flex-shrink-0 text-right tabular-nums text-[var(--color-gray-mid)]">
                {formatMinutes(block.minutes)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Calidad percibida ──────────────────────────────── */}
      <section>
        <h3 className="heading-section text-[var(--color-text)] mb-3">Cómo fueron tus sesiones</h3>

        {focus.ratedSessions === 0 ? (
          <p className="flex items-start gap-2 text-sm text-[var(--color-text-soft)]">
            <Sparkles size={15} className="text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
            Al terminar una sesión puedes decir cómo te fue. Con unas cuantas
            calificadas verás si el tiempo que dedicas te está cundiendo.
          </p>
        ) : (
          <>
            <p className="text-meta mb-3">
              Sobre {focus.ratedSessions}{' '}
              {focus.ratedSessions === 1 ? 'sesión calificada' : 'sesiones calificadas'} ·{' '}
              {formatMinutes(focus.ratedMinutes)}
            </p>

            {/* Barra apilada: el reparto se lee de un vistazo y las tres
                respuestas caben en una línea. */}
            <div
              className="flex h-2.5 rounded-full overflow-hidden bg-[var(--color-gray-border)] mb-3"
              role="img"
              aria-label="Reparto del tiempo calificado"
            >
              {focus.totals.map((t) => (
                <span
                  key={t.rating}
                  style={{ width: `${t.share}%`, background: FOCUS_META[t.rating].bar }}
                />
              ))}
            </div>

            <ul className="space-y-1.5">
              {focus.totals.map((t) => {
                const meta = FOCUS_META[t.rating];
                const Icon = meta.icon;
                return (
                  <li key={t.rating} className="flex items-center gap-2 text-sm">
                    <Icon
                      size={15}
                      className="flex-shrink-0"
                      style={{ color: meta.bar }}
                      aria-hidden
                    />
                    <span className="flex-1 text-[var(--color-text)]">{meta.label}</span>
                    <span className="tabular-nums text-[var(--color-text-soft)]">
                      {formatMinutes(t.minutes)}
                    </span>
                    <span className="w-10 text-right tabular-nums text-[var(--color-gray-mid)]">
                      {t.share.toFixed(0)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
