import { createClient } from '@/lib/supabase/server';
import { CategoryModel } from '@/lib/models';
import { TimerClient } from '@/components/timer/TimerClient';

export default async function TimerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const categoryModel = new CategoryModel(supabase);

  const [categories, { data: sessions }, { data: profile }] = await Promise.all([
    categoryModel.findAllByUser(user!.id),
    supabase
      .from('study_sessions')
      .select('*, category:categories(name, color)')
      .eq('user_id', user!.id)
      .order('started_at', { ascending: false })
      .limit(50),
    supabase
      .from('profiles')
      .select('daily_goal_minutes, weekly_goal_minutes')
      .eq('id', user!.id)
      .single(),
  ]);

  return (
    <TimerClient
      categories={categories}
      initialSessions={sessions ?? []}
      dailyGoal={profile?.daily_goal_minutes ?? 60}
      weeklyGoal={profile?.weekly_goal_minutes ?? 300}
    />
  );
}
