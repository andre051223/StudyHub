import { redirect } from 'next/navigation';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { Navbar } from '@/components/shared/Navbar';
import { ConfirmProvider } from '@/components/shared/ConfirmProvider';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { InstallPrompt } from '@/components/shared/InstallPrompt';
import { TimerProvider } from '@/components/timer/TimerProvider';
import { TimerIndicator } from '@/components/timer/TimerIndicator';
import { DEFAULT_POMODORO } from '@/lib/types';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'full_name, pomodoro_focus_minutes, pomodoro_break_minutes, pomodoro_long_break_minutes, pomodoro_cycles_before_long_break'
    )
    .eq('id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Navbar
        userEmail={user.email}
        userName={profile?.full_name ?? undefined}
      />
      <div className="pt-[68px]">
        {/* El temporizador vive aquí y no en /timer para que siga corriendo
            —y guarde la sesión al terminar— mientras se navega por la app.
            Ver components/timer/TimerProvider.tsx. */}
        <TimerProvider
          initialPomodoro={{
            focusMinutes: profile?.pomodoro_focus_minutes ?? DEFAULT_POMODORO.focusMinutes,
            breakMinutes: profile?.pomodoro_break_minutes ?? DEFAULT_POMODORO.breakMinutes,
            longBreakMinutes:
              profile?.pomodoro_long_break_minutes ?? DEFAULT_POMODORO.longBreakMinutes,
            cyclesBeforeLongBreak:
              profile?.pomodoro_cycles_before_long_break ??
              DEFAULT_POMODORO.cyclesBeforeLongBreak,
          }}
        >
          {/* Un solo diálogo de confirmación para toda el área autenticada.
              Ver components/shared/ConfirmProvider.tsx. */}
          <ConfirmProvider>
            {children}
            {/* Ctrl+K desde cualquier pantalla del área autenticada. */}
            <CommandPalette />
            <InstallPrompt />
            {/* Reloj activo visible fuera de /timer. */}
            <TimerIndicator />
          </ConfirmProvider>
        </TimerProvider>
      </div>
    </div>
  );
}
