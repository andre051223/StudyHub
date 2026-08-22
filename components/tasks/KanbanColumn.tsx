'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Maximize2, Minimize2 } from 'lucide-react';
import type { Task, TaskQuadrant } from '@/lib/types';
import { TaskCard } from './TaskCard';

interface Props {
  quadrant: { id: TaskQuadrant; label: string; color: string; bg: string };
  tasks: Task[];
  onAddTask: () => void;
  onCardClick: (task: Task) => void;
  onToggleComplete: (id: string, completed: boolean) => void;
  /** Celda de la rejilla 2×2 en móvil: menos aire y tarjetas resumidas. */
  compact?: boolean;
  /** Este cuadrante ocupa la pantalla completa (solo en móvil). */
  expanded?: boolean;
  /** Ausente en escritorio, donde no hay nada que expandir. */
  onToggleExpand?: () => void;
}

export function KanbanColumn({
  quadrant,
  tasks,
  onAddTask,
  onCardClick,
  onToggleComplete,
  compact = false,
  expanded = false,
  onToggleExpand,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: quadrant.id });

  const width = expanded ? 'w-full flex-1' : compact ? 'w-full min-w-0' : 'w-72 flex-shrink-0';

  return (
    <div
      className={`flex flex-col min-h-0 rounded-xl border-2 ${width} ${quadrant.bg} transition-shadow ${
        isOver ? 'shadow-lg' : ''
      }`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between ${compact ? 'px-2.5 py-2' : 'px-4 py-3'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <h3 className={`font-semibold ${compact ? 'text-xs' : 'text-sm'} truncate ${quadrant.color}`}>
            {quadrant.label}
          </h3>
          {/* La superficie del tema, no `bg-white/60`: el chip claro sobre el
              fondo oscuro del cuadrante era una fuga del modo noche. */}
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${quadrant.color} bg-[var(--color-surface)]/70`}
          >
            {tasks.length}
          </span>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className={`p-1 rounded-lg hover:bg-[var(--color-surface)]/80 transition-colors ${quadrant.color}`}
              aria-label={expanded ? `Contraer ${quadrant.label}` : `Expandir ${quadrant.label}`}
            >
              {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
          <button
            onClick={onAddTask}
            className={`p-1 rounded-lg hover:bg-[var(--color-surface)]/80 transition-colors ${quadrant.color}`}
            aria-label={`Agregar tarea en ${quadrant.label}`}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-0 flex flex-col overflow-y-auto ${
          compact ? 'gap-1.5 px-1.5 pb-1.5' : 'gap-2 px-3 pb-3 min-h-24'
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              compact={compact}
              onToggleComplete={onToggleComplete}
              onClick={() => onCardClick(task)}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-6">
            <p className="text-xs text-[var(--color-gray-mid)] text-center">
              {compact ? 'Vacío' : (<>Sin tareas aquí.<br />Arrastra o añade una.</>)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
