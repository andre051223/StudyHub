import { redirect } from 'next/navigation';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { Navbar } from '@/components/shared/Navbar';
import { ConfirmProvider } from '@/components/shared/ConfirmProvider';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { InstallPrompt } from '@/components/shared/InstallPrompt';

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
    .select('full_name')
    .eq('id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Navbar
        userEmail={user.email}
        userName={profile?.full_name ?? undefined}
      />
      <div className="pt-[68px]">
        {/* Un solo diálogo de confirmación para toda el área autenticada.
            Ver components/shared/ConfirmProvider.tsx. */}
        <ConfirmProvider>
          {children}
          {/* Ctrl+K desde cualquier pantalla del área autenticada. */}
          <CommandPalette />
          <InstallPrompt />
        </ConfirmProvider>
      </div>
    </div>
  );
}
