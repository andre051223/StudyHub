import { createClient } from '@/lib/supabase/server';
import { CategoryModel } from '@/lib/models';
import { TasksClient } from '@/components/tasks/TasksClient';

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const categoryModel = new CategoryModel(supabase);

  const [{ data: tasks }, categories] = await Promise.all([
    supabase
      .from('tasks')
      .select('*, subtasks(*), category:categories(*)')
      .eq('user_id', user!.id)
      .order('position', { ascending: true }),
    categoryModel.findAllByUser(user!.id),
  ]);

  return (
    <div className="flex flex-col h-[calc(100vh-68px)]">
      <div className="px-6 py-4 bg-[var(--color-surface)] border-b border-[var(--color-gray-border)]">
        <h1 className="text-xl font-bold text-[var(--color-text)]">Tareas</h1>
        <p className="text-sm text-[var(--color-text-soft)] mt-0.5">
          Matriz de Eisenhower — organiza por urgencia e importancia
        </p>
      </div>
      <TasksClient
        initialTasks={tasks ?? []}
        categories={categories}
      />
    </div>
  );
}
