import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { NotesClient } from '@/components/notes/NotesClient';

export default async function NotesPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const [{ data: folders }, { data: notes }] = await Promise.all([
    supabase
      .from('folders')
      .select('*, note_count:notes(count)')
      .eq('user_id', user!.id)
      .order('name'),
    supabase
      .from('notes')
      .select('id, title, content_text, tags, folder_id, updated_at, created_at')
      .eq('user_id', user!.id)
      .order('updated_at', { ascending: false }),
  ]);

  return (
    <NotesClient
      initialFolders={folders ?? []}
      initialNotes={notes ?? []}
    />
  );
}
