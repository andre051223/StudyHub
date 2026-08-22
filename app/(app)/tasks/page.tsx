import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { CategoryModel, SessionModel } from '@/lib/models';
import { TasksClient } from '@/components/tasks/TasksClient';
import type { Task } from '@/lib/types';

export default async function TasksPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const categoryModel = new CategoryModel(supabase);
  const sessionModel = new SessionModel(supabase);

  const [{ data: tasks }, categories, studiedByTask] = await Promise.all([
    supabase
      .from('tasks')
      .select('*, subtasks(*), category:categories(*)')
      .eq('user_id', user!.id)
      .order('position', { ascending: true }),
    categoryModel.findAllByUser(user!.id),
    // Tiempo dedicado a cada tarea. Va en una consulta aparte y no en un
    // `select` anidado porque PostgREST no agrega: ver studiedSecondsByTask().
    sessionModel.studiedSecondsByTask(user!.id),
  ]);

  const tasksWithTime = ((tasks ?? []) as Task[]).map((task) => ({
    ...task,
    studied_seconds: studiedByTask.get(task.id) ?? 0,
  }));

  return (
    <div className="flex flex-col h-[calc(100vh-68px)]">
      <div className="px-6 py-4 bg-[var(--color-surface)] border-b border-[var(--color-gray-border)]">
        <h1 className="heading-page text-[var(--color-text)]">Tareas</h1>
        <p className="text-sm text-[var(--color-text-soft)] mt-0.5">
          Matriz de Eisenhower — organiza por urgencia e importancia
        </p>
      </div>
      <TasksClient initialTasks={tasksWithTime} categories={categories} />
    </div>
  );
}
