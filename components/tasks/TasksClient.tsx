'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Filter } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  createTaskAction,
  updateTaskAction,
  deleteTaskAction,
  reorderTasksAction,
} from '@/app/(app)/tasks/actions';
import { useConfirm } from '@/components/shared/ConfirmProvider';
import { useMediaQuery, COMPACT_QUERY } from '@/hooks/useMediaQuery';
import type { Task, TaskQuadrant, Category } from '@/lib/types';
import { TaskCard } from './TaskCard';
import { TaskModal } from './TaskModal';
import { KanbanColumn } from './KanbanColumn';

/**
 * Paleta de los cuadrantes.
 *
 * «Planificar» era verde de marca, el mismo `#67b31f` que pintan todos los
 * botones de acción del producto: en esta pantalla había un cuadrante entero
 * del color que en el resto de la aplicación significa «pulsa aquí». Ahora los
 * cuatro cuadrantes usan una escala propia por intensidad —rojo, índigo,
 * ámbar, gris— y el verde queda reservado para las acciones.
 */
export const QUADRANTS: { id: TaskQuadrant; label: string; color: string; bg: string }[] = [
  {
    id: 'urgent_important',
    label: 'Hacer ahora',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/25',
  },
  {
    id: 'not_urgent_important',
    label: 'Planificar',
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/25',
  },
  {
    id: 'urgent_not_important',
    label: 'Delegar',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/25',
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
  // Supabase directo solo para el cambio optimista de una sola fila y sin
  // reglas: marcar completada. Crear, editar, borrar y reordenar pasan por
  // Server Actions (ver app/(app)/tasks/actions.ts).
  const supabase = createClient();
  const confirm = useConfirm();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [modalTask, setModalTask] = useState<Task | null | 'new'>(null);
  const [newTaskQuadrant, setNewTaskQuadrant] = useState<TaskQuadrant>('not_urgent_important');
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  // En móvil los cuatro cuadrantes se ven a la vez en una rejilla 2×2 y se
  // expande uno a pantalla completa al tocarlo. Ver la nota de `compactGrid`.
  const isCompact = useMediaQuery(COMPACT_QUERY);
  const [expandedQuadrant, setExpandedQuadrant] = useState<TaskQuadrant | null>(null);
  const expanded = isCompact ? expandedQuadrant : null;

  // MouseSensor y TouchSensor separados, no un PointerSensor único: con el
  // umbral de 8 px que necesita el ratón, cualquier deslizamiento del dedo
  // para hacer scroll dentro de una columna se interpretaba como arrastre. En
  // táctil manda el tiempo (mantener pulsado), no la distancia.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const visibleTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (!showCompleted && t.completed) return false;
        if (filterCategoryId && t.category_id !== filterCategoryId) return false;
        return true;
      }),
    [tasks, showCompleted, filterCategoryId]
  );

  function getFilteredTasks(quadrant: TaskQuadrant) {
    return visibleTasks.filter((t) => t.quadrant === quadrant);
  }

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }

  /**
   * Reconstruye la lista con un cuadrante entero reordenado.
   *
   * Las columnas se pintan filtrando `tasks` en el orden del array, así que no
   * basta con escribir `position`: hay que dejar el array en ese mismo orden.
   */
  function applyOrder(prev: Task[], quadrant: TaskQuadrant, ordered: Task[]): Task[] {
    const reordered = new Map(
      ordered.map((t, position) => [t.id, { ...t, quadrant, position }])
    );
    return [...prev.filter((t) => !reordered.has(t.id)), ...reordered.values()];
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const moved = tasks.find((t) => t.id === active.id);
    if (!moved) return;

    const overId = String(over.id);
    const overQuadrant = QUADRANTS.find((q) => q.id === overId)?.id;
    const overTask = tasks.find((t) => t.id === overId);
    const target = overQuadrant ?? overTask?.quadrant ?? moved.quadrant;

    // El orden se calcula sobre *todas* las tareas del cuadrante, no solo
    // sobre las visibles: si hay un filtro activo, las ocultas también tienen
    // posición y reescribir únicamente las visibles las descolocaría.
    const quadrantTasks = tasks.filter((t) => t.quadrant === target);
    let ordered: Task[];

    if (target === moved.quadrant) {
      const from = quadrantTasks.findIndex((t) => t.id === moved.id);
      const to = overTask
        ? quadrantTasks.findIndex((t) => t.id === overTask.id)
        : quadrantTasks.length - 1;
      if (to === -1 || from === to) return;
      ordered = arrayMove(quadrantTasks, from, to);
    } else {
      const at = overTask
        ? quadrantTasks.findIndex((t) => t.id === overTask.id)
        : quadrantTasks.length;
      const insertAt = at === -1 ? quadrantTasks.length : at;
      ordered = [
        ...quadrantTasks.slice(0, insertAt),
        moved,
        ...quadrantTasks.slice(insertAt),
      ];
    }

    const previous = tasks;
    setTasks((prev) => applyOrder(prev, target, ordered));

    const result = await reorderTasksAction({
      quadrant: target,
      orderedIds: ordered.map((t) => t.id),
    });

    if (!result.ok) {
      setTasks(previous);
      toast.error(result.error);
    }
  }

  async function handleToggleComplete(taskId: string, completed: boolean) {
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

  async function handleDeleteTask(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    const ok = await confirm({
      title: '¿Eliminar la tarea?',
      message: task
        ? `«${task.title}» y sus subtareas se eliminarán definitivamente.`
        : 'La tarea y sus subtareas se eliminarán definitivamente.',
    });
    if (!ok) return;

    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    const result = await deleteTaskAction(taskId);
    if (!result.ok) {
      setTasks(previous);
      toast.error(result.error);
      return;
    }
    // El modal de la tarea eliminada se cierra desde aquí y no desde el propio
    // modal: si la confirmación se cancela, debe quedarse abierto.
    setModalTask(null);
    toast.success('Tarea eliminada');
  }

  async function handleSaveTask(data: Partial<Task>) {
    if (!data.id) {
      // TaskModel calcula la position inicial dentro del cuadrante y recorta
      // el título; por eso la creación no arma la fila aquí.
      const result = await createTaskAction({
        title: data.title,
        description: data.description ?? null,
        quadrant: data.quadrant ?? newTaskQuadrant,
        deadline: data.deadline ?? null,
        category_id: data.category_id ?? null,
      });

      if (!result.ok) { toast.error(result.error); return; }
      setTasks((prev) => [...prev, result.data]);
      toast.success('Tarea creada');
    } else {
      const result = await updateTaskAction(data.id, {
        title: data.title,
        description: data.description ?? null,
        quadrant: data.quadrant,
        deadline: data.deadline ?? null,
        category_id: data.category_id ?? null,
      });

      if (!result.ok) { toast.error(result.error); return; }
      // El modelo devuelve la tarea con sus subtareas; conservarlas evita que
      // el contador de la tarjeta parpadee tras guardar.
      setTasks((prev) => prev.map((t) => (t.id === data.id ? result.data : t)));
      toast.success('Tarea actualizada');
    }
    setModalTask(null);
  }

  function openNewTask(quadrant: TaskQuadrant) {
    setNewTaskQuadrant(quadrant);
    setModalTask('new');
  }

  const visibleQuadrants = expanded
    ? QUADRANTS.filter((q) => q.id === expanded)
    : QUADRANTS;

  /**
   * En pantallas anchas la matriz es una fila de cuatro columnas de 288 px con
   * desplazamiento horizontal. En un móvil eso mostraba una columna y un
   * cuarto, y la matriz de Eisenhower solo comunica su idea si se ven los
   * cuatro cuadrantes a la vez: en compacto pasa a una rejilla 2×2 con
   * tarjetas resumidas, y se expande un cuadrante a pantalla completa al tocar
   * su cabecera.
   */
  const compactLayout = expanded
    ? 'flex flex-col p-3 h-full'
    : 'grid grid-cols-2 grid-rows-2 gap-2 p-3 h-full';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Filters bar */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-3 bg-[var(--color-surface)] border-b border-[var(--color-gray-border)] flex-wrap">
        <Filter size={15} className="text-[var(--color-gray-mid)]" />
        <select
          value={filterCategoryId ?? ''}
          onChange={(e) => setFilterCategoryId(e.target.value || null)}
          aria-label="Filtrar por categoría"
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
      <div className={`flex-1 min-h-0 ${isCompact ? 'overflow-y-auto' : 'overflow-x-auto'}`}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className={isCompact ? compactLayout : 'flex gap-4 p-6 min-w-[900px] h-full'}>
            {visibleQuadrants.map((quadrant) => (
              <KanbanColumn
                key={quadrant.id}
                quadrant={quadrant}
                tasks={getFilteredTasks(quadrant.id)}
                compact={isCompact && !expanded}
                expanded={expanded === quadrant.id}
                onToggleExpand={
                  isCompact
                    ? () =>
                        setExpandedQuadrant((prev) =>
                          prev === quadrant.id ? null : quadrant.id
                        )
                    : undefined
                }
                onAddTask={() => openNewTask(quadrant.id)}
                onCardClick={(task) => setModalTask(task)}
                onToggleComplete={handleToggleComplete}
              />
            ))}
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
