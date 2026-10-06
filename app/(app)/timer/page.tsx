import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { CategoryModel, SessionModel } from '@/lib/models';
import { TimerClient } from '@/components/timer/TimerClient';
import type { OpenTask } from '@/lib/types';

export default async function TimerPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const categoryModel = new CategoryModel(supabase);
  const sessionModel = new SessionModel(supabase);

  // Dos consultas con propósitos distintos:
  //
  //  · `sessions` alimenta la lista de historial, que muestra la fila completa
  //    (modo, notas, categoría) pero solo de las últimas 50.
  //  · `statsSessions` alimenta las gráficas, la racha y las metas. Necesita
  //    muchas más filas pero solo cuatro columnas. Antes las estadísticas se
  //    derivaban del mismo `limit(50)` que el historial, así que a partir de
  //    la sesión 51 la racha se cortaba sola.
  const [
    categories,
    { data: sessions },
    statsSessions,
    { data: profile },
    { data: openTasks },
    studiedByTask,
  ] = await Promise.all([
    categoryModel.findAllByUser(user!.id),
    supabase
      .from('study_sessions')
      .select('*, category:categories(name, color), task:tasks(id, title)')
      .eq('user_id', user!.id)
      .order('started_at', { ascending: false })
      .limit(50),
    sessionModel.findForStats(user!.id),
    supabase
      .from('profiles')
      .select(
        'daily_goal_minutes, weekly_goal_minutes'
      )
      .eq('id', user!.id)
      .single(),
    // Tareas pendientes para el selector del temporizador (migración 006):
    // poder estudiar "para el parcial de Cálculo" y no solo "Cálculo".
    supabase
      .from('tasks')
      .select('id, title, quadrant, category_id, estimated_minutes')
      .eq('user_id', user!.id)
      .eq('completed', false)
      .order('position', { ascending: true })
      .limit(100),
    // Tiempo ya dedicado a cada tarea, para poder contrastarlo con su
    // estimación mientras se estudia y no solo al abrir el Kanban.
    sessionModel.studiedSecondsByTask(user!.id),
  ]);

  const tasksWithTime: OpenTask[] = (openTasks ?? []).map((task) => ({
    ...task,
    studied_seconds: studiedByTask.get(task.id) ?? 0,
  }));

  return (
    <TimerClient
      categories={categories}
      initialSessions={sessions ?? []}
      initialStatsSessions={statsSessions}
      openTasks={tasksWithTime}
      dailyGoal={profile?.daily_goal_minutes ?? 60}
      weeklyGoal={profile?.weekly_goal_minutes ?? 300}
    />
  );
}
