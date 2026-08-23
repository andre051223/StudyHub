'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { startOfLocalWeek, localDayKey } from '@/lib/stats';
import { deadlineDay, isOverdue } from '@/lib/deadlines';
import { useLocalToday } from '@/hooks/useLocalToday';
import type { Task } from '@/lib/types';

interface Props {
  tasks: Task[];
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Color del borde izquierdo según el cuadrante, igual que en el Kanban. */
const QUADRANT_ACCENT: Record<Task['quadrant'], string> = {
  urgent_important: 'border-l-red-500',
  not_urgent_important: 'border-l-indigo-500',
  urgent_not_important: 'border-l-amber-500',
  not_urgent_not_important: 'border-l-gray-400',
};

export function AgendaClient({ tasks: initialTasks }: Props) {
  const supabase = createClient();
  const [tasks, setTasks] = useState(initialTasks);
  // Desplazamiento en semanas respecto a la actual: 0 = esta semana.
  const [weekOffset, setWeekOffset] = useState(0);

  // Qué semana es «esta» depende de la zona del usuario. Calculado durante el
  // render de servidor —UTC en Vercel— la agenda saltaba a la semana siguiente
  // a partir del domingo por la tarde, y el texto distinto entre servidor y
  // cliente rompía la hidratación. Hasta que hay navegador no hay semana.
  const todayMs = useLocalToday();

  const { days, rangeLabel, isCurrentWeek } = useMemo(() => {
    if (todayMs === null) {
      return { days: null, rangeLabel: '', isCurrentWeek: true };
    }

    const start = startOfLocalWeek(new Date(todayMs));
    start.setDate(start.getDate() + weekOffset * 7);

    // Las tareas se agrupan por su día de calendario, no por el instante
    // guardado: `deadlineDay()` lee la fecha en UTC y la devuelve como día
    // local, que es la que el usuario eligió en el formulario.
    const byDay = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.deadline) continue;
      const key = localDayKey(deadlineDay(task.deadline));
      const bucket = byDay.get(key);
      if (bucket) bucket.push(task);
      else byDay.set(key, [task]);
    }

    const todayKey = localDayKey(todayMs);
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const key = localDayKey(date);
      return {
        key,
        date,
        label: WEEKDAYS[i],
        isToday: key === todayKey,
        tasks: byDay.get(key) ?? [],
      };
    });

    const end = days[6].date;
    const sameMonth = start.getMonth() === end.getMonth();
    const fmt = (d: Date, withMonth: boolean) =>
      d.toLocaleDateString('es-CO', {
        day: 'numeric',
        ...(withMonth ? { month: 'long' } : {}),
        ...(start.getFullYear() === end.getFullYear() ? {} : { year: 'numeric' }),
      });

    return {
      days,
      rangeLabel: `${fmt(start, !sameMonth)} – ${fmt(end, true)}`,
      isCurrentWeek: weekOffset === 0,
    };
  }, [tasks, weekOffset, todayMs]);

  // Lo vencido no pertenece a ninguna semana: se muestra siempre arriba, o
  // dejaría de verse en cuanto el usuario navegue hacia adelante.
  const overdue = useMemo(() => {
    if (todayMs === null) return [];
    const now = new Date(todayMs);
    return tasks.filter((t) => !t.completed && t.deadline && isOverdue(t.deadline, now));
  }, [tasks, todayMs]);

  async function toggleComplete(taskId: string, completed: boolean) {
    const previous = tasks;
    const completedAt = completed ? new Date().toISOString() : null;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed, completed_at: completedAt } : t))
    );

    const { error } = await supabase
      .from('tasks')
      .update({ completed, completed_at: completedAt })
      .eq('id', taskId);

    if (error) {
      setTasks(previous);
      toast.error('No se pudo actualizar la tarea');
    }
  }

  return (
    <div className="space-y-4">
      {/* Barra de navegación de semanas */}
      <div className="flex items-center gap-2 bg-[var(--color-surface)] rounded-xl px-4 py-3 shadow-[var(--shadow-card)]">
        <CalendarDays size={16} className="text-[var(--color-gray-mid)] flex-shrink-0" />
        <h2 className="heading-section flex-1 min-w-0 truncate capitalize min-h-[1.4em]">
          {rangeLabel}
        </h2>

        {!isCurrentWeek && (
          <button
            onClick={() => setWeekOffset(0)}
            className="text-sm px-3 py-1.5 rounded-lg text-[var(--color-primary)] hover:bg-[var(--color-gray-light)] transition-colors"
          >
            Hoy
          </button>
        )}
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          aria-label="Semana anterior"
          className="p-1.5 rounded-lg text-[var(--color-text-soft)] hover:bg-[var(--color-gray-light)] transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          aria-label="Semana siguiente"
          className="p-1.5 rounded-lg text-[var(--color-text-soft)] hover:bg-[var(--color-gray-light)] transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Atrasadas */}
      {overdue.length > 0 && (
        <section className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 rounded-xl p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400 mb-3">
            <AlertTriangle size={15} />
            Atrasadas ({overdue.length})
          </h3>
          <div className="space-y-1.5">
            {overdue.map((task) => (
              <AgendaTask key={task.id} task={task} onToggle={toggleComplete} showDate />
            ))}
          </div>
        </section>
      )}

      {/* Semana */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {days === null
          ? Array.from({ length: 7 }, (_, i) => (
              <section
                key={i}
                aria-busy="true"
                className="rounded-xl border border-[var(--color-gray-border)] bg-[var(--color-surface)] p-3 min-h-32"
              />
            ))
          : days.map((day) => (
              <section
                key={day.key}
                className={`rounded-xl border p-3 min-h-32 ${
                  day.isToday
                    ? 'border-[var(--color-primary)] bg-[var(--color-surface)]'
                    : 'border-[var(--color-gray-border)] bg-[var(--color-surface)]'
                }`}
              >
                <header className="flex items-baseline gap-2 mb-2">
                  <span className="text-eyebrow">{day.label}</span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      day.isToday ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'
                    }`}
                  >
                    {day.date.getDate()}
                  </span>
                  {day.tasks.length > 0 && (
                    <span className="text-meta ml-auto">{day.tasks.length}</span>
                  )}
                </header>

                {day.tasks.length === 0 ? (
                  <p className="text-meta">—</p>
                ) : (
                  <div className="space-y-1.5">
                    {day.tasks.map((task) => (
                      <AgendaTask key={task.id} task={task} onToggle={toggleComplete} />
                    ))}
                  </div>
                )}
              </section>
            ))}
      </div>

      <p className="text-meta text-center">
        Las fechas límite se editan desde{' '}
        <Link href="/tasks" className="text-[var(--color-primary)] hover:underline">
          la matriz de tareas
        </Link>
        .
      </p>
    </div>
  );
}

function AgendaTask({
  task,
  onToggle,
  showDate,
}: {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
  showDate?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border-l-2 bg-[var(--color-gray-light)] px-2 py-1.5 ${
        QUADRANT_ACCENT[task.quadrant]
      } ${task.completed ? 'opacity-60' : ''}`}
    >
      <input
        type="checkbox"
        checked={task.completed}
        onChange={(e) => onToggle(task.id, e.target.checked)}
        aria-label={task.completed ? `Marcar ${task.title} pendiente` : `Completar ${task.title}`}
        className="mt-0.5 accent-[var(--color-primary)] flex-shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-xs leading-snug ${
            task.completed
              ? 'line-through text-[var(--color-gray-mid)]'
              : 'text-[var(--color-text)]'
          }`}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {task.category && (
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: task.category.color }}
              title={task.category.name}
            />
          )}
          {showDate && task.deadline && (
            <span className="text-[11px] text-[var(--color-text-soft)]">
              {deadlineDay(task.deadline).toLocaleDateString('es-CO', {
                day: '2-digit',
                month: 'short',
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
