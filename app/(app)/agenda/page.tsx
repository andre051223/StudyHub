import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { AgendaClient } from '@/components/agenda/AgendaClient';
import type { Task } from '@/lib/types';

/**
 * Agenda de fechas límite  (D2).
 *
 * `tasks.deadline` existía desde la primera migración, tenía índice, y solo se
 * veía como una etiqueta pequeña dentro de una tarjeta del Kanban. La matriz
 * de Eisenhower responde «qué es importante»; no responde «qué me cae encima
 * esta semana», que es la pregunta que obligaba a mantener un calendario
 * aparte.
 *
 * Se traen todas las tareas con fecha —son pocas por definición— y la semana
 * la decide el cliente: así navegar entre semanas es instantáneo y, sobre
 * todo, el corte entre días se hace en la zona horaria del usuario y no en la
 * del servidor (ver lib/deadlines.ts).
 */
export default async function AgendaPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, category:categories(*)')
    .eq('user_id', user!.id)
    .not('deadline', 'is', null)
    .order('deadline', { ascending: true })
    .limit(500);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <header className="mb-6">
        <h1 className="heading-page text-[var(--color-text)]">Agenda</h1>
        <p className="text-sm text-[var(--color-text-soft)] mt-0.5">
          Tus fechas límite, semana a semana
        </p>
      </header>

      <AgendaClient tasks={(tasks ?? []) as Task[]} />
    </div>
  );
}
