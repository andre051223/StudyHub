'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, Tag, CheckSquare2 } from 'lucide-react';
import type { Task } from '@/lib/types';
import { isOverdue, isDueToday, formatDate } from '@/lib/utils';

interface Props {
  task: Task;
  onToggleComplete: (id: string, completed: boolean) => void;
  onClick: () => void;
  isDragging?: boolean;
}

export function TaskCard({ task, onToggleComplete, onClick, isDragging }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;

  const deadlineColor =
    task.deadline && !task.completed
      ? isOverdue(task.deadline)
        ? 'text-red-600'
        : isDueToday(task.deadline)
        ? 'text-yellow-600'
        : 'text-[var(--color-text-soft)]'
      : 'text-[var(--color-text-soft)]';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-[var(--color-surface)] rounded-lg p-3 shadow-[var(--shadow-card)] cursor-pointer select-none transition-all ${
        isDragging || isSortableDragging ? 'opacity-50 rotate-1 shadow-lg' : 'hover:-translate-y-0.5'
      } ${task.completed ? 'opacity-60' : ''}`}
      onClick={onClick}
      {...attributes}
      {...listeners}
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
            className={`text-sm font-medium text-[var(--color-text)] leading-snug ${
              task.completed ? 'line-through text-[var(--color-gray-mid)]' : ''
            }`}
          >
            {task.title}
          </p>

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
              <span className={`flex items-center gap-1 text-xs ${deadlineColor}`}>
                <Calendar size={11} />
                {formatDate(task.deadline)}
              </span>
            )}

            {totalSubtasks > 0 && (
              <span className="flex items-center gap-1 text-xs text-[var(--color-text-soft)]">
                <CheckSquare2 size={11} />
                {completedSubtasks}/{totalSubtasks}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
