'use client';

import { Smile, Meh, Frown, type LucideIcon } from 'lucide-react';
import { FOCUS_RATINGS, type FocusRatingKey } from '@/lib/stats';

/**
 * Presentación de la calificación de una sesión (migración 009).
 *
 * Vive aparte porque las mismas tres respuestas aparecen en cuatro sitios: el
 * aviso al terminar, el formulario de edición, cada fila del historial y el
 * desglose de calidad de las estadísticas. Tenerlas repetidas garantizaba que
 * tarde o temprano una pantalla llamara «Normal» a lo que otra llama «Regular».
 */

export interface FocusMeta {
  label: string;
  /** Pregunta en primera persona, para los botones del aviso. */
  prompt: string;
  icon: LucideIcon;
  /** Clases del chip; con variante oscura, que los tonos 600 no la tienen. */
  chip: string;
  /** Color sólido para barras y puntos, donde no hay problema de contraste. */
  bar: string;
}

export const FOCUS_META: Record<FocusRatingKey, FocusMeta> = {
  focused: {
    label: 'Concentrado',
    prompt: 'Concentrado',
    icon: Smile,
    chip: 'text-[var(--color-primary)] bg-[var(--color-primary)]/12',
    bar: '#67b31f',
  },
  ok: {
    label: 'Normal',
    prompt: 'Normal',
    icon: Meh,
    chip: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15',
    bar: '#f59e0b',
  },
  distracted: {
    label: 'Disperso',
    prompt: 'Disperso',
    icon: Frown,
    chip: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15',
    bar: '#ef4444',
  },
};

/** Chip de solo lectura, para el historial. */
export function FocusChip({ rating }: { rating: FocusRatingKey }) {
  const meta = FOCUS_META[rating];
  const Icon = meta.icon;
  return (
    <span
      className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${meta.chip}`}
    >
      <Icon size={11} aria-hidden />
      {meta.label}
    </span>
  );
}

interface PickerProps {
  value: FocusRatingKey | null;
  onChange: (value: FocusRatingKey | null) => void;
  /** A false, volver a pulsar la opción activa no la deselecciona. */
  clearable?: boolean;
  disabled?: boolean;
}

/** Selector de las tres respuestas. Un grupo de radio, no tres botones sueltos. */
export function FocusRatingPicker({
  value,
  onChange,
  clearable = true,
  disabled,
}: PickerProps) {
  return (
    <div role="radiogroup" aria-label="Cómo fue la sesión" className="flex gap-2">
      {FOCUS_RATINGS.map((rating) => {
        const meta = FOCUS_META[rating];
        const Icon = meta.icon;
        const active = value === rating;
        return (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(active && clearable ? null : rating)}
            className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-60 ${
              active
                ? `${meta.chip} border-current`
                : 'border-[var(--color-gray-border)] text-[var(--color-text-soft)] hover:bg-[var(--color-gray-light)]'
            }`}
          >
            <Icon size={15} aria-hidden />
            {meta.prompt}
          </button>
        );
      })}
    </div>
  );
}
