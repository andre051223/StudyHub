import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { NoteEditor } from '@/components/notes/NoteEditor';

interface Props {
  params: Promise<{ noteId: string }>;
}

export default async function NoteEditorPage({ params }: Props) {
  const { noteId } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();

  const [{ data: note }, { data: folders }] = await Promise.all([
    supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .eq('user_id', user!.id)
      .single(),
    supabase
      .from('folders')
      .select('id, name')
      .eq('user_id', user!.id)
      .order('name'),
  ]);

  if (!note) notFound();

  return <NoteEditor note={note} folders={folders ?? []} />;
}
