'use client';

import { useState, useOptimistic, useTransition } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { Task, TaskQuadrant, Category } from '@/lib/types';
import { TaskCard } from './TaskCard';
import { TaskModal } from './TaskModal';
import { KanbanColumn } from './KanbanColumn';

const QUADRANTS: { id: TaskQuadrant; label: string; color: string; bg: string }[] = [
  {
    id: 'urgent_important',
    label: 'Hacer ahora',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/25',
  },
  {
    id: 'not_urgent_important',
    label: 'Planificar',
    color: 'text-[#67b31f] dark:text-[var(--color-primary-light)]',
    bg: 'bg-[#67b31f0d] border-[#67b31f33] dark:bg-[#67b31f1a] dark:border-[#67b31f40]',
  },
  {
    id: 'urgent_not_important',
    label: 'Delegar',
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-500/10 dark:border-yellow-500/25',
  },
  {
    id: 'not_urgent_not_important',
    label: 'Eliminar',
    color: 'text-gray-500 dark:text-[var(--color-text-soft)]',
    bg: 'bg-gray-50 border-gray-200 dark:bg-white/5 dark:border-[var(--color-gray-border)]',
  },
];

interface Props {
  initialTasks: Task[];
  categories: Category[];
}

export function TasksClient({ initialTasks, categories }: Props) {
  const supabase = createClient();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [modalTask, setModalTask] = useState<Task | null | 'new'>(null);
  const [newTaskQuadrant, setNewTaskQuadrant] = useState<TaskQuadrant>('not_urgent_important');
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function getFilteredTasks(quadrant: TaskQuadrant) {
    return tasks.filter((t) => {
      if (t.quadrant !== quadrant) return false;
      if (!showCompleted && t.completed) return false;
      if (filterCategoryId && t.category_id !== filterCategoryId) return false;
      return true;
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    const overId = over.id as string;
    const overQuadrant = QUADRANTS.find((q) => q.id === overId);
    const overTask = tasks.find((t) => t.id === overId);
    const targetQuadrant = overQuadrant?.id ?? overTask?.quadrant ?? activeTask.quadrant;

    if (targetQuadrant === activeTask.quadrant) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === activeTask.id ? { ...t, quadrant: targetQuadrant } : t))
    );

    const { error } = await supabase
      .from('tasks')
      .update({ quadrant: targetQuadrant })
      .eq('id', activeTask.id);

    if (error) {
      toast.error('Error al mover la tarea');
      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeTask.id ? { ...t, quadrant: activeTask.quadrant } : t
        )
      );
    }
  }

  async function handleToggleComplete(taskId: string, completed: boolean) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, completed, completed_at: completed ? new Date().toISOString() : null }
          : t
      )
    );

    await supabase
      .from('tasks')
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq('id', taskId);
  }

  async function handleDeleteTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await supabase.from('tasks').delete().eq('id', taskId);
    toast.success('Tarea eliminada');
  }

  async function handleSaveTask(data: Partial<Task>) {
    if (!data.id) {
      // Create
      const { data: created, error } = await supabase
        .from('tasks')
        .insert({
          title: data.title!,
          description: data.description ?? null,
          quadrant: data.quadrant ?? newTaskQuadrant,
          deadline: data.deadline ?? null,
          category_id: data.category_id ?? null,
          position: tasks.filter((t) => t.quadrant === (data.quadrant ?? newTaskQuadrant)).length,
        })
        .select('*, category:categories(*)')
        .single();

      if (error) { toast.error('Error al crear tarea'); return; }
      setTasks((prev) => [...prev, created as Task]);
      toast.success('Tarea creada');
    } else {
      // Update
      const { data: updated, error } = await supabase
        .from('tasks')
        .update({
          title: data.title,
          description: data.description,
          quadrant: data.quadrant,
          deadline: data.deadline,
          category_id: data.category_id,
        })
        .eq('id', data.id)
        .select('*, category:categories(*)')
        .single();

      if (error) { toast.error('Error al actualizar tarea'); return; }
      setTasks((prev) => prev.map((t) => (t.id === data.id ? (updated as Task) : t)));
      toast.success('Tarea actualizada');
    }
    setModalTask(null);
  }

  function openNewTask(quadrant: TaskQuadrant) {
    setNewTaskQuadrant(quadrant);
    setModalTask('new');
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Filters bar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-[var(--color-surface)] border-b border-[var(--color-gray-border)] flex-wrap">
        <Filter size={15} className="text-[var(--color-gray-mid)]" />
        <select
          value={filterCategoryId ?? ''}
          onChange={(e) => setFilterCategoryId(e.target.value || null)}
          className="text-sm border border-[var(--color-gray-border)] rounded-lg px-3 py-1.5 text-[var(--color-text-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-soft)] cursor-pointer">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="accent-[var(--color-primary)]"
          />
          Mostrar completadas
        </label>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 p-6 min-w-[900px] h-full">
            {QUADRANTS.map((quadrant) => {
              const columnTasks = getFilteredTasks(quadrant.id);
              return (
                <KanbanColumn
                  key={quadrant.id}
                  quadrant={quadrant}
                  tasks={columnTasks}
                  onAddTask={() => openNewTask(quadrant.id)}
                  onCardClick={(task) => setModalTask(task)}
                  onToggleComplete={handleToggleComplete}
                />
              );
            })}
          </div>

          <DragOverlay>
            {activeTask && (
              <TaskCard
                task={activeTask}
                onToggleComplete={() => {}}
                onClick={() => {}}
                isDragging
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Modal */}
      {modalTask !== null && (
        <TaskModal
          task={modalTask === 'new' ? null : modalTask}
          defaultQuadrant={newTaskQuadrant}
          categories={categories}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onClose={() => setModalTask(null)}
        />
      )}
    </div>
  );
}
