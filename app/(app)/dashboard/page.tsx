import { createClient, getCurrentUser } from '@/lib/supabase/server';
import Link from 'next/link';
import { ArrowRight, FileText, ListChecks, Play } from 'lucide-react';
import { SessionModel } from '@/lib/models';
import { endOfTodayForQuery } from '@/lib/deadlines';
import type { Task } from '@/lib/types';
import { TodayStats } from '@/components/dashboard/TodayStats';
import { DueToday } from '@/components/dashboard/DueToday';
import { LocalDate } from '@/components/dashboard/LocalDate';

/**
 * El dashboard es la primera pantalla tras iniciar sesión y era la más pobre:
 * tres contadores, tres accesos directos y cinco filas de sesiones. Nada de
 * eso se puede accionar, y los accesos directos duplicaban la barra de
 * navegación, que ya está siempre visible.
 *
 * Ahora responde a las cuatro preguntas del día con datos que la aplicación ya
 * tenía y no enseñaba: qué vence hoy y qué está vencido, cómo va la meta
 * diaria, cuánto mide la racha, y por dónde seguir.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const sessionModel = new SessionModel(supabase);

  const [
    { data: profile },
    statsSessions,
    { data: dueTasks },
    { data: focusTasks },
    { data: lastNote },
    { count: pendingTaskCount },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, daily_goal_minutes')
      .eq('id', user!.id)
      .single(),

    // Una sola consulta alimenta meta, racha y semana; los agregados se
    // calculan en el navegador para que el día natural sea el del usuario.
    sessionModel.findForStats(user!.id),

    // Pendientes con plazo hasta el final de hoy. El margen de un día extra lo
    // recorta `DueToday` en la zona del usuario (ver lib/deadlines.ts).
    supabase
      .from('tasks')
      .select('*, category:categories(*)')
      .eq('user_id', user!.id)
      .eq('completed', false)
      .not('deadline', 'is', null)
      .lte('deadline', endOfTodayForQuery())
      .order('deadline', { ascending: true })
      .limit(20),

    // Lo siguiente del cuadrante «Hacer ahora», en el orden que el usuario le
    // dio arrastrando.
    supabase
      .from('tasks')
      .select('id, title')
      .eq('user_id', user!.id)
      .eq('completed', false)
      .eq('quadrant', 'urgent_important')
      .order('position', { ascending: true })
      .limit(3),

    supabase
      .from('notes')
      .select('id, title, updated_at')
      .eq('user_id', user!.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user!.id)
      .eq('completed', false),
  ]);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Estudiante';

  return (
    <main className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <header className="mb-7">
        <h1 className="heading-page text-[var(--color-text)]">Hola, {firstName}</h1>
        <LocalDate />
      </header>

      <TodayStats
        sessions={statsSessions}
        dailyGoal={profile?.daily_goal_minutes ?? 60}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <DueToday tasks={(dueTasks ?? []) as Task[]} />
        </div>

        {/* Continuar donde lo dejaste */}
        <section className="bg-[var(--color-surface)] rounded-xl shadow-[var(--shadow-card)] overflow-hidden flex flex-col">
          <header className="px-5 py-4 border-b border-[var(--color-gray-border)]">
            <h2 className="heading-section">Continuar</h2>
          </header>

          <div className="p-5 space-y-5 flex-1">
            <Link
              href="/timer"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              <Play size={15} />
              Iniciar sesión de estudio
            </Link>

            <div>
              <h3 className="text-eyebrow mb-2">Última nota</h3>
              {lastNote ? (
                <Link
                  href={`/notes/${lastNote.id}`}
                  className="flex items-center gap-2 text-sm text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors"
                >
                  <FileText size={14} className="text-[var(--color-gray-mid)] flex-shrink-0" />
                  <span className="truncate">{lastNote.title || 'Sin título'}</span>
                </Link>
              ) : (
                <Link href="/notes" className="text-sm text-[var(--color-primary)] hover:underline">
                  Escribe tu primera nota
                </Link>
              )}
            </div>

            <div>
              <h3 className="text-eyebrow mb-2">Hacer ahora</h3>
              {focusTasks && focusTasks.length > 0 ? (
                <ul className="space-y-1.5">
                  {focusTasks.map((task) => (
                    <li key={task.id} className="flex items-start gap-2 text-sm text-[var(--color-text)]">
                      <ListChecks size={14} className="mt-0.5 text-[var(--color-gray-mid)] flex-shrink-0" />
                      <span className="truncate">{task.title}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-meta">
                  Nada urgente e importante. {pendingTaskCount ?? 0} pendientes en total.
                </p>
              )}
            </div>
          </div>

          <Link
            href="/tasks"
            className="flex items-center justify-center gap-1 px-5 py-3 text-sm text-[var(--color-primary)] border-t border-[var(--color-gray-border)] hover:bg-[var(--color-gray-light)] transition-colors"
          >
            Abrir la matriz <ArrowRight size={14} />
          </Link>
        </section>
      </div>
    </main>
  );
}
