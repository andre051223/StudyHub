'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarClock, CheckCircle2 } from 'lucide-react';
import type { Task } from '@/lib/types';
import { deadlineStatus, formatDeadline } from '@/lib/deadlines';

interface Props {
  /** Tareas pendientes con fecha límite, ya acotadas por la consulta. */
  tasks: Task[];
}

/**
 * Lo que vence hoy y lo que ya venció.
 *
 * `tasks.deadline` existía desde el principio, pero solo aparecía como una
 * etiqueta dentro de una tarjeta, en otra pantalla. Era el dato más accionable
 * del producto y el dashboard no lo mostraba.
 *
 * El filtro final se hace aquí y no en la consulta porque «hoy» depende de la
 * zona horaria del usuario, que el servidor no conoce: la consulta acota con
 * margen de un día y el navegador decide. Ver `lib/deadlines.ts`.
 */
export function DueToday({ tasks }: Props) {
  const due = useMemo(
    () =>
      tasks
        .map((task) => ({ task, status: deadlineStatus(task.deadline!) }))
        .filter(({ status }) => status === 'overdue' || status === 'today')
        .sort((a, b) => a.task.deadline!.localeCompare(b.task.deadline!)),
    [tasks]
  );

  const overdueCount = due.filter((d) => d.status === 'overdue').length;

  return (
    <section className="bg-[var(--color-surface)] rounded-xl shadow-[var(--shadow-card)] overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--color-gray-border)]">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarClock size={16} className="text-[var(--color-gray-mid)] flex-shrink-0" />
          <h2 className="heading-section">Para hoy</h2>
          {overdueCount > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400">
              {overdueCount} {overdueCount === 1 ? 'vencida' : 'vencidas'}
            </span>
          )}
        </div>
        <Link
          href="/tasks"
          className="text-sm text-[var(--color-primary)] hover:underline flex items-center gap-1 flex-shrink-0"
        >
          Ver tareas <ArrowRight size={14} />
        </Link>
      </header>

      {due.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <CheckCircle2 size={22} className="mx-auto mb-2 text-[var(--color-gray-mid)]" />
          <p className="text-sm text-[var(--color-text)]">Nada vence hoy.</p>
          <p className="text-meta mt-1">
            Buen momento para adelantar algo del cuadrante «Planificar».
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-gray-border)]">
          {due.map(({ task, status }) => (
            <li key={task.id}>
              <Link
                href="/tasks"
                className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--color-gray-light)] transition-colors"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: task.category?.color ?? 'var(--color-gray-mid)' }}
                  aria-hidden
                />
                <span className="flex-1 min-w-0 text-sm text-[var(--color-text)] truncate">
                  {task.title}
                </span>
                <span
                  className={`text-xs font-medium flex-shrink-0 ${
                    status === 'overdue'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {formatDeadline(task.deadline!)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
