'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  formatMinutes,
  heatmapLevel,
  heatmapWeeks,
  heatmapWeekSpan,
  type StatsSession,
} from '@/lib/stats';

/**
 * Mapa de calor del historial: una celda por día, una columna por semana.
 *
 * La racha resume la constancia en un número («7 días») y la gráfica de barras
 * solo alcanza a ver una semana. Entre las dos se pierde justo lo que interesa
 * a medio plazo: si el hábito aguanta en época de parciales, cuántas semanas
 * se cayeron enteras, si se estudia los fines de semana.
 *
 * La ventana arranca en la semana de la primera sesión y no en «hace un año»:
 * ver `heatmapWeekSpan`.
 */

/** Techo de la ventana. Más de un año no cabe legible en una fila. */
const MAX_WEEKS = 53;

/**
 * Verde de marca a cuatro opacidades. Con opacidad y no con cuatro verdes
 * fijos porque el fondo cambia entre temas: un `#eaf5df` calculado para el
 * modo claro se convierte en una mancha pálida sobre el fondo oscuro.
 */
const LEVEL_STYLE: Record<number, { background: string; opacity?: number }> = {
  0: { background: 'var(--color-gray-border)' },
  1: { background: 'var(--color-primary)', opacity: 0.28 },
  2: { background: 'var(--color-primary)', opacity: 0.5 },
  3: { background: 'var(--color-primary)', opacity: 0.75 },
  4: { background: 'var(--color-primary)', opacity: 1 },
};

/** Solo se etiquetan lunes, miércoles y viernes: con siete no cabe el texto. */
const WEEKDAY_LABELS = ['Lun', '', 'Mié', '', 'Vie', '', ''];

interface Props {
  /** Sesiones ya filtradas a completadas por el componente padre. */
  sessions: StatsSession[];
}

export function StudyHeatmap({ sessions }: Props) {
  const { weeks, weekCount, max, monthLabels, activeDays, totalMinutes, from } = useMemo(() => {
    const weekCount = heatmapWeekSpan(sessions, new Date(), MAX_WEEKS);
    const grid = heatmapWeeks(sessions, weekCount);
    const past = grid.flat().filter((d) => !d.isFuture);

    // Una etiqueta de mes en la primera columna cuyo lunes cae en un mes
    // distinto al de la columna anterior.
    const labels: { index: number; label: string }[] = [];
    let lastMonth = -1;
    grid.forEach((week, i) => {
      const month = week[0].date.getMonth();
      if (month !== lastMonth) {
        labels.push({ index: i, label: format(week[0].date, 'LLL', { locale: es }) });
        lastMonth = month;
      }
    });

    return {
      weeks: grid,
      weekCount,
      max: past.reduce((m, d) => Math.max(m, d.minutes), 0),
      monthLabels: labels,
      activeDays: past.filter((d) => d.minutes > 0).length,
      totalMinutes: past.reduce((acc, d) => acc + d.minutes, 0),
      from: grid[0][0].date,
    };
  }, [sessions]);

  // Con pocas semanas, celdas de 11 px dejarían un bloque diminuto perdido a
  // la izquierda del panel. El tamaño se sube cuando el historial es corto y
  // vuelve a bajar en cuanto la ventana se acerca al año.
  const cell = weekCount > 30 ? 11 : weekCount > 16 ? 14 : 18;
  const columns = `repeat(${weekCount}, ${cell}px)`;
  const rows = `repeat(7, ${cell}px)`;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h3 className="heading-section text-[var(--color-text)]">Constancia</h3>
        <p className="text-meta">
          Desde {format(from, "LLLL 'de' yyyy", { locale: es })} · {activeDays}{' '}
          {activeDays === 1 ? 'día' : 'días'} con estudio · {formatMinutes(totalMinutes)} en total
        </p>
      </div>

      {/* Un año no cabe en un móvil: el scroll vive aquí dentro para que la
          página no se desplace en horizontal. */}
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex gap-1.5 min-w-max">
          {/* Días de la semana */}
          <div
            className="grid gap-[3px] pr-1"
            style={{ gridTemplateRows: rows, paddingTop: 15 }}
            aria-hidden
          >
            {WEEKDAY_LABELS.map((label, i) => (
              <span
                key={i}
                className="text-[9px] text-[var(--color-gray-mid)] text-right"
                style={{ lineHeight: `${cell}px` }}
              >
                {label}
              </span>
            ))}
          </div>

          <div>
            {/* Meses */}
            <div
              className="grid gap-[3px] mb-1"
              style={{ gridTemplateColumns: columns }}
              aria-hidden
            >
              {Array.from({ length: weekCount }, (_, i) => {
                const label = monthLabels.find((m) => m.index === i);
                return (
                  <span
                    key={i}
                    className="text-[9px] leading-3 text-[var(--color-gray-mid)] whitespace-nowrap"
                  >
                    {label?.label ?? ''}
                  </span>
                );
              })}
            </div>

            <div
              className="grid grid-flow-col gap-[3px]"
              style={{ gridTemplateRows: rows, gridTemplateColumns: columns }}
            >
              {weeks.flat().map((day) =>
                day.isFuture ? (
                  <span key={day.key} />
                ) : (
                  <span
                    key={day.key}
                    // `title` y no un tooltip propio: es la única forma de que
                    // el dato exacto esté disponible sin JavaScript extra, y en
                    // táctil el resumen de arriba ya da el total.
                    title={`${format(day.date, "d 'de' LLLL", { locale: es })}: ${formatMinutes(
                      day.minutes
                    )}`}
                    className="rounded-[2px]"
                    style={{
                      width: cell,
                      height: cell,
                      ...LEVEL_STYLE[heatmapLevel(day.minutes, max)],
                    }}
                  />
                )
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1.5 mt-2 text-meta">
        <span>Menos</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className="w-[11px] h-[11px] rounded-[2px]"
            style={LEVEL_STYLE[level]}
            aria-hidden
          />
        ))}
        <span>Más</span>
      </div>
    </section>
  );
}
