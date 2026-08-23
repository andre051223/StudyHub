'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, CheckSquare2, GripVertical, Timer } from 'lucide-react';
import type { Task } from '@/lib/types';
import { deadlineStatus, formatDeadline } from '@/lib/deadlines';
import { useLocalToday } from '@/hooks/useLocalToday';
import { formatMinutes } from '@/lib/stats';

interface Props {
  task: Task;
  onToggleComplete: (id: string, completed: boolean) => void;
  onClick: () => void;
  isDragging?: boolean;
  /** Rejilla 2×2 en móvil: solo título y un rastro de contexto. */
  compact?: boolean;
}

/**
 * Colores del plazo. Antes eran `text-red-600` y `text-yellow-600` sin
 * variante `dark:` —los dos únicos del archivo que no la tenían—, así que en
 * modo noche el dato más importante de la tarjeta perdía contraste.
 */
const DEADLINE_COLOR = {
  overdue: 'text-red-600 dark:text-red-400',
  today: 'text-amber-600 dark:text-amber-400',
  tomorrow: 'text-[var(--color-text-soft)]',
  upcoming: 'text-[var(--color-text-soft)]',
} as const;

export function TaskCard({ task, onToggleComplete, onClick, isDragging, compact }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;

  // El día lo pone el navegador: en el servidor (UTC en Vercel) un plazo de
  // hoy se etiquetaba «Ayer» a partir de las 19:00 hora de Colombia, y ese
  // texto distinto entre servidor y cliente rompía la hidratación.
  const todayMs = useLocalToday();
  const today = todayMs === null ? null : new Date(todayMs);
  const status =
    today && task.deadline && !task.completed ? deadlineStatus(task.deadline, today) : null;

  // Tiempo dedicado a la tarea desde el temporizador (migración 006). Se
  // muestra a partir de un minuto: por debajo es ruido.
  const studiedMinutes = Math.round((task.studied_seconds ?? 0) / 60);

  // Contraste con la estimación (migración 009). El porcentaje se calcula
  // aunque no se haya estudiado nada: «0 % de 1h 30m» sigue diciendo cuánto
  // queda por delante, que es la mitad del valor de haber estimado.
  const estimate = task.estimated_minutes;
  const estimatePct = estimate ? Math.round((studiedMinutes / estimate) * 100) : null;
  const overEstimate = estimatePct !== null && estimatePct > 100;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-[var(--color-surface)] rounded-lg shadow-[var(--shadow-card)] cursor-pointer select-none transition-all ${
        compact ? 'p-2' : 'p-3'
      } ${
        isDragging || isSortableDragging ? 'opacity-50 rotate-1 shadow-lg' : 'hover:-translate-y-0.5'
      } ${task.completed ? 'opacity-60' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(task.id, !task.completed);
          }}
          className="mt-0.5 flex-shrink-0"
          aria-label={task.completed ? 'Marcar pendiente' : 'Marcar completa'}
        >
          <div
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
              task.completed
                ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                : 'border-[var(--color-gray-border)]'
            }`}
          >
            {task.completed && (
              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </button>

        <div className="flex-1 min-w-0">
          <p
            className={`${compact ? 'text-xs line-clamp-2' : 'text-sm'} font-medium text-[var(--color-text)] leading-snug ${
              task.completed ? 'line-through text-[var(--color-gray-mid)]' : ''
            }`}
          >
            {task.title}
          </p>

          {compact ? (
            // En la rejilla no cabe la fila de chips: queda un punto de color
            // por categoría y el plazo, que es lo que decide si actúas hoy.
            (task.category || status) && (
              <div className="flex items-center gap-1.5 mt-1">
                {task.category && (
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: task.category.color }}
                    title={task.category.name}
                  />
                )}
                {status && task.deadline && (
                  <span className={`text-[11px] truncate ${DEADLINE_COLOR[status]}`}>
                    {today ? formatDeadline(task.deadline, today) : ''}
                  </span>
                )}
              </div>
            )
          ) : (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {task.category && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: task.category.color + '22',
                    color: task.category.color,
                  }}
                >
                  {task.category.name}
                </span>
              )}

              {task.deadline && (
                <span
                  className={`flex items-center gap-1 text-xs ${
                    status ? DEADLINE_COLOR[status] : 'text-[var(--color-text-soft)]'
                  }`}
                >
                  <Calendar size={11} />
                  {today ? formatDeadline(task.deadline, today) : ''}
                </span>
              )}

              {totalSubtasks > 0 && (
                <span className="flex items-center gap-1 text-xs text-[var(--color-text-soft)]">
                  <CheckSquare2 size={11} />
                  {completedSubtasks}/{totalSubtasks}
                </span>
              )}

              {estimate ? (
                <span
                  className={`flex items-center gap-1 text-xs ${
                    overEstimate
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-[var(--color-text-soft)]'
                  }`}
                  title={`${formatMinutes(studiedMinutes)} estudiados de ${formatMinutes(
                    estimate
                  )} estimados`}
                >
                  <Timer size={11} />
                  {formatMinutes(studiedMinutes)} / {formatMinutes(estimate)}
                </span>
              ) : (
                studiedMinutes > 0 && (
                  <span
                    className="flex items-center gap-1 text-xs text-[var(--color-text-soft)]"
                    title="Tiempo estudiado en esta tarea"
                  >
                    <Timer size={11} />
                    {formatMinutes(studiedMinutes)}
                  </span>
                )
              )}
            </div>
          )}

          {/* Barra de avance sobre lo estimado. Solo con estimación: sin ella
              no hay un «total» contra el que dibujar nada. */}
          {!compact && estimatePct !== null && (
            <div
              className="mt-1.5 h-1 rounded-full bg-[var(--color-gray-border)] overflow-hidden"
              role="img"
              aria-label={`${estimatePct}% del tiempo estimado`}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, estimatePct)}%`,
                  background: overEstimate ? '#f59e0b' : 'var(--color-primary)',
                }}
              />
            </div>
          )}
        </div>

        {/* Asa de arrastre dedicada. Antes los listeners cubrían la tarjeta
            entera, así que en táctil cualquier scroll dentro de la columna
            empezaba un arrastre y el toque para abrir competía con él. */}
        <button
          ref={setActivatorNodeRef}
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="-mr-1 mt-0.5 flex-shrink-0 cursor-grab touch-none rounded p-0.5 text-[var(--color-gray-mid)] opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
          aria-label={`Mover ${task.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={compact ? 12 : 14} />
        </button>
      </div>
    </div>
  );
}
