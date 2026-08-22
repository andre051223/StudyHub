import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { ProfileClient } from '@/components/shared/ProfileClient';

export default async function ProfilePage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single();

  return (
    <main className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="heading-page text-[var(--color-text)] mb-6">Mi perfil</h1>
      <ProfileClient profile={profile} email={user?.email ?? ''} />
    </main>
  );
}
