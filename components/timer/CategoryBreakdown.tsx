'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Minus, PieChart, TrendingDown, TrendingUp } from 'lucide-react';
import {
  categoryBreakdown,
  comparePeriods,
  formatMinutes,
  rangeStart,
  RANGE_LABELS,
  type CategoryShare,
  type PeriodComparison,
  type StatsRange,
  type StatsSession,
} from '@/lib/stats';

interface Props {
  /** Sesiones ya filtradas a completadas por el componente padre. */
  sessions: StatsSession[];
}

/** Columnas por las que se puede ordenar la tabla. */
type SortKey = 'time' | 'name';
type SortDir = 'asc' | 'desc';

const RANGES: StatsRange[] = ['day', 'week', 'month'];

/** Etiqueta del botón del filtro; el título ya dice de qué periodo se habla. */
const RANGE_BUTTON_LABELS: Record<StatsRange, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
};

function sortRows(rows: CategoryShare[], key: SortKey, dir: SortDir): CategoryShare[] {
  const factor = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) =>
    key === 'time'
      ? factor * (a.minutes - b.minutes) || a.name.localeCompare(b.name, 'es')
      : factor * a.name.localeCompare(b.name, 'es')
  );
}

function SortableHeader({
  label,
  columnKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
}: {
  label: string;
  columnKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = activeKey === columnKey;
  const Arrow = dir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th
      scope="col"
      // `aria-sort` es lo que anuncia el lector de pantalla; sin él la flecha
      // es información puramente visual.
      aria-sort={isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`py-2 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={`inline-flex items-center gap-1 rounded hover:text-[var(--color-text)] transition-colors ${
          isActive ? 'text-[var(--color-text)]' : ''
        }`}
      >
        {label}
        <Arrow size={12} className={isActive ? 'opacity-100' : 'opacity-0'} aria-hidden />
      </button>
    </th>
  );
}

/** Cómo se nombra el periodo anterior en la frase de comparación. */
const PREVIOUS_LABELS: Record<StatsRange, string> = {
  day: 'ayer a esta hora',
  week: 'la semana pasada a estas alturas',
  month: 'el mes pasado a estas alturas',
};

/**
 * Variación contra el periodo anterior, recortado al mismo avance.
 *
 * La coletilla «a estas alturas» no es un adorno: `comparePeriods` compara un
 * martes contra los dos primeros días de la semana anterior, no contra los
 * siete. Sin decirlo, el número parecería estar comparando semanas completas.
 */
function PeriodDelta({
  range,
  comparison,
}: {
  range: StatsRange;
  comparison: PeriodComparison;
}) {
  if (comparison.current === 0 && comparison.previous === 0) return null;

  if (comparison.deltaPct === null) {
    return (
      <p className="text-meta mt-0.5">
        {formatMinutes(comparison.current)} · sin registro {PREVIOUS_LABELS[range]}
      </p>
    );
  }

  const rounded = Math.round(comparison.deltaPct);
  const Icon = rounded > 0 ? TrendingUp : rounded < 0 ? TrendingDown : Minus;
  const tone =
    rounded > 0
      ? 'text-[var(--color-primary)]'
      : rounded < 0
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-[var(--color-gray-mid)]';

  return (
    <p className="flex items-center gap-1.5 text-meta mt-0.5">
      {formatMinutes(comparison.current)}
      <span className={`flex items-center gap-0.5 font-medium ${tone}`}>
        <Icon size={12} aria-hidden />
        {rounded > 0 ? '+' : ''}
        {rounded}%
      </span>
      <span>
        vs. {formatMinutes(comparison.previous)} {PREVIOUS_LABELS[range]}
      </span>
    </p>
  );
}

/**
 * Tabla de tiempo estudiado por categoría, ordenada de mayor a menor.
 *
 * Sustituye a la gráfica circular que había antes. El problema del circular no
 * era estético: con más de cuatro categorías los sectores pequeños quedaban sin
 * etiqueta legible, dos porciones parecidas no se podían comparar a ojo, y el
 * valor en minutos solo aparecía al pasar el cursor —es decir, nunca en móvil.
 * Una tabla ordenada responde de un vistazo la pregunta real («¿a qué le estoy
 * dedicando más tiempo?») y admite el filtro por rango, que el circular fijaba
 * al mes en curso.
 */
export function CategoryBreakdown({ sessions }: Props) {
  const [range, setRange] = useState<StatsRange>('month');
  const [sortKey, setSortKey] = useState<SortKey>('time');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const rows = useMemo(
    () => categoryBreakdown(sessions, rangeStart(range)),
    [sessions, range]
  );

  const sorted = useMemo(() => sortRows(rows, sortKey, sortDir), [rows, sortKey, sortDir]);
  const comparison = useMemo(() => comparePeriods(sessions, range), [sessions, range]);

  // El total se suma sobre las filas visibles y no sobre el rango completo: si
  // se fijara en 100 % / el total real, no cuadraría con la columna cuando hay
  // categorías descartadas por redondear a cero minutos.
  const total = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({ minutes: acc.minutes + r.minutes, share: acc.share + r.share }),
        { minutes: 0, share: 0 }
      ),
    [rows]
  );

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    // Cada columna tiene un orden «natural» distinto: el tiempo se quiere de
    // mayor a menor, los nombres de la A a la Z.
    setSortDir(key === 'time' ? 'desc' : 'asc');
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="heading-section text-[var(--color-text)]">
            Tiempo por categoría · {RANGE_LABELS[range].toLowerCase()}
          </h3>
          <PeriodDelta range={range} comparison={comparison} />
        </div>

        <div
          role="group"
          aria-label="Periodo del desglose"
          className="flex items-center gap-1 p-1 rounded-lg bg-[var(--color-gray-light)]"
        >
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                range === r
                  ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                  : 'text-[var(--color-text-soft)] hover:text-[var(--color-text)]'
              }`}
            >
              {RANGE_BUTTON_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-[var(--color-text-soft)] py-6 text-center bg-[var(--color-gray-light)] rounded-xl">
          Sin sesiones completadas en este periodo.
        </p>
      ) : (
        // La tabla puede desbordar en pantallas estrechas; el scroll vive en
        // este contenedor para que la página no se desplace en horizontal.
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <caption className="sr-only">
              Tiempo de estudio por categoría, {RANGE_LABELS[range].toLowerCase()}, ordenado
              de mayor a menor.
            </caption>
            <thead>
              <tr className="text-eyebrow border-b border-[var(--color-gray-border)]">
                <th scope="col" className="py-2 pr-2 text-left w-8">
                  #
                </th>
                <SortableHeader
                  label="Categoría"
                  columnKey="name"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Tiempo"
                  columnKey="time"
                  activeKey={sortKey}
                  dir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <th scope="col" className="py-2 pl-3 text-right w-32">
                  % del total
                </th>
              </tr>
            </thead>

            <tbody>
              {sorted.map((row, i) => (
                <tr
                  key={row.name}
                  className="border-b border-[var(--color-gray-border)] last:border-0"
                >
                  <td className="py-2.5 pr-2 tabular-nums text-[var(--color-gray-mid)]">
                    {i + 1}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        aria-hidden
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: row.color }}
                      />
                      <span className="truncate text-[var(--color-text)]">{row.name}</span>
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums font-medium text-[var(--color-text)] whitespace-nowrap">
                    {formatMinutes(row.minutes)}
                  </td>
                  <td className="py-2.5 pl-3">
                    <span className="flex items-center justify-end gap-2">
                      <span
                        aria-hidden
                        className="hidden sm:block h-1.5 w-16 rounded-full bg-[var(--color-gray-border)] overflow-hidden"
                      >
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${row.share}%`, backgroundColor: row.color }}
                        />
                      </span>
                      <span className="tabular-nums text-[var(--color-text-soft)] w-10 text-right">
                        {row.share.toFixed(0)}%
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-[var(--color-gray-border)]">
                <td />
                <td className="py-2.5 pr-3 font-semibold text-[var(--color-text)]">Total</td>
                <td className="py-2.5 text-right tabular-nums font-semibold text-[var(--color-text)] whitespace-nowrap">
                  {formatMinutes(total.minutes)}
                </td>
                <td className="py-2.5 pl-3 text-right tabular-nums text-[var(--color-text-soft)]">
                  {total.share.toFixed(0)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="flex items-center gap-1.5 mt-2 text-meta text-[var(--color-gray-mid)]">
        <PieChart size={12} aria-hidden />
        Solo cuentan las sesiones completadas.
      </p>
    </section>
  );
}
