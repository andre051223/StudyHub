import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { BookOpen, CheckSquare, Timer, ArrowRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [
    { data: profile },
    { count: noteCount },
    { count: pendingTaskCount },
    { data: recentSessions },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user!.id).single(),
    supabase.from('notes').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user!.id)
      .eq('completed', false),
    supabase
      .from('study_sessions')
      .select('id, duration_minutes, started_at, completed_at')
      .eq('user_id', user!.id)
      .order('started_at', { ascending: false })
      .limit(5),
  ]);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Estudiante';

  const totalMinutesThisWeek =
    recentSessions
      ?.filter((s) => {
        const d = new Date(s.started_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return d >= weekAgo && s.completed_at !== null;
      })
      .reduce((acc, s) => acc + (s.duration_minutes ?? 0), 0) ?? 0;

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          Hola, {firstName} 👋
        </h1>
        <p className="text-[var(--color-text-soft)] mt-1">
          {new Date().toLocaleDateString('es-CO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Notas creadas" value={String(noteCount ?? 0)} color="blue" />
        <StatCard label="Tareas pendientes" value={String(pendingTaskCount ?? 0)} color="green" />
        <StatCard
          label="Minutos esta semana"
          value={String(totalMinutesThisWeek)}
          color="orange"
        />
      </div>

      {/* Quick access */}
      <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Acceso rápido</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <QuickCard
          href="/notes"
          icon={BookOpen}
          title="Notas"
          desc="Escribe y organiza tus apuntes"
          color="blue"
        />
        <QuickCard
          href="/tasks"
          icon={CheckSquare}
          title="Tareas"
          desc="Gestiona tu carga académica"
          color="green"
        />
        <QuickCard
          href="/timer"
          icon={Timer}
          title="Temporizador"
          desc="Inicia una sesión de estudio"
          color="orange"
        />
      </div>

      {/* Recent sessions */}
      {recentSessions && recentSessions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              Sesiones recientes
            </h2>
            <Link
              href="/timer"
              className="text-sm text-[var(--color-primary)] hover:underline flex items-center gap-1"
            >
              Ver todo <ArrowRight size={14} />
            </Link>
          </div>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-gray-border)] overflow-hidden">
            {recentSessions.map((s, i) => (
              <div
                key={s.id}
                className={`flex items-center justify-between px-5 py-3 text-sm ${
                  i < recentSessions.length - 1
                    ? 'border-b border-[var(--color-gray-border)]'
                    : ''
                }`}
              >
                <span className="text-[var(--color-text)]">
                  {formatDate(s.started_at)}
                </span>
                <span className="text-[var(--color-text-soft)]">
                  {s.duration_minutes} min
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    s.completed_at
                      ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-[var(--color-text-soft)]'
                  }`}
                >
                  {s.completed_at ? 'Completada' : 'Abandonada'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'blue' | 'green' | 'orange';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
    green: 'bg-[#67b31f1a] text-[#67b31f] dark:text-[var(--color-primary-light)]',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400',
  };

  // Toma solo las clases de texto (text-* y su variante dark:), no el fondo.
  const textColor = colors[color]
    .split(' ')
    .filter((c) => c.includes('text-'))
    .join(' ');

  return (
    <div className="bg-[var(--color-surface)] rounded-xl p-5 shadow-[var(--shadow-card)]">
      <p className="text-sm text-[var(--color-text-soft)] mb-1">{label}</p>
      <p className={`text-3xl font-bold ${textColor}`}>{value}</p>
    </div>
  );
}

function QuickCard({
  href,
  icon: Icon,
  title,
  desc,
  color,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  desc: string;
  color: 'blue' | 'green' | 'orange';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
    green: 'bg-[#67b31f1a] text-[#67b31f] dark:text-[var(--color-primary-light)]',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400',
  };

  return (
    <Link
      href={href}
      className="bg-[var(--color-surface)] rounded-xl p-5 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-all hover:-translate-y-1 flex items-start gap-4"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <h3 className="font-semibold text-[var(--color-text)]">{title}</h3>
        <p className="text-sm text-[var(--color-text-soft)] mt-0.5">{desc}</p>
      </div>
      <ArrowRight size={16} className="text-[var(--color-gray-mid)] ml-auto mt-1" />
    </Link>
  );
}
