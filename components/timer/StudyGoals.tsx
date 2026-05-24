'use client';

import { useState, useMemo } from 'react';
import { Flame, Target, CheckCircle2, Edit2, X, Save } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { startOfDay, subDays, startOfWeek } from 'date-fns';
import type { StudySession } from '@/lib/types';

interface Props {
  sessions: (StudySession & { category?: { name: string; color: string } | null })[];
  dailyGoal: number;
  weeklyGoal: number;
}

export function StudyGoals({ sessions, dailyGoal: initialDaily, weeklyGoal: initialWeekly }: Props) {
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(initialDaily);
  const [weeklyGoal, setWeeklyGoal] = useState(initialWeekly);
  const [tempDaily, setTempDaily] = useState(initialDaily);
  const [tempWeekly, setTempWeekly] = useState(initialWeekly);
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = startOfDay(now).toISOString().slice(0, 10);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });

    const completed = sessions.filter((s) => s.completed_at !== null);

    const todayMinutes = completed
      .filter((s) => s.started_at.slice(0, 10) === todayStr)
      .reduce((acc, s) => acc + s.duration_minutes, 0);

    const weekMinutes = completed
      .filter((s) => new Date(s.started_at) >= weekStart)
      .reduce((acc, s) => acc + s.duration_minutes, 0);

    // Streak: consecutive days with at least one completed session
    const uniqueDates = [...new Set(completed.map((s) => s.started_at.slice(0, 10)))].sort(
      (a, b) => b.localeCompare(a)
    );

    let streak = 0;
    if (uniqueDates.length > 0) {
      const yesterday = subDays(startOfDay(now), 1).toISOString().slice(0, 10);
      if (uniqueDates[0] === todayStr || uniqueDates[0] === yesterday) {
        for (let i = 0; i < uniqueDates.length; i++) {
          const expected = subDays(startOfDay(now), i + (uniqueDates[0] === yesterday ? 1 : 0))
            .toISOString()
            .slice(0, 10);
          if (uniqueDates[i] !== expected) break;
          streak++;
        }
      }
    }

    return { todayMinutes, weekMinutes, streak };
  }, [sessions]);

  async function handleSave() {
    if (tempDaily < 5 || tempDaily > 480 || tempWeekly < 30 || tempWeekly > 2400) {
      toast.error('Valores fuera de rango');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ daily_goal_minutes: tempDaily, weekly_goal_minutes: tempWeekly })
      .eq('id', (await supabase.auth.getUser()).data.user!.id);
    setSaving(false);
    if (error) {
      toast.error('Error al guardar las metas');
      return;
    }
    setDailyGoal(tempDaily);
    setWeeklyGoal(tempWeekly);
    setEditing(false);
    toast.success('Metas actualizadas');
  }

  function handleCancel() {
    setTempDaily(dailyGoal);
    setTempWeekly(weeklyGoal);
    setEditing(false);
  }

  const dailyPct = Math.min(100, Math.round((stats.todayMinutes / dailyGoal) * 100));
  const weeklyPct = Math.min(100, Math.round((stats.weekMinutes / weeklyGoal) * 100));

  return (
    <div className="space-y-5">
      {/* Streak banner */}
      <div className="flex items-center gap-3 bg-[var(--color-gray-light)] rounded-xl p-4">
        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
          <Flame size={20} className="text-orange-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">Racha actual</p>
          <p className="text-2xl font-bold text-orange-500">
            {stats.streak} {stats.streak === 1 ? 'día' : 'días'}
          </p>
        </div>
        {stats.streak >= 7 && (
          <div className="ml-auto">
            <CheckCircle2 size={24} className="text-[var(--color-primary)]" />
          </div>
        )}
      </div>

      {/* Daily goal */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={15} className="text-[var(--color-primary)]" />
            <span className="text-sm font-medium text-[var(--color-text)]">Meta diaria</span>
          </div>
          <span className="text-sm text-[var(--color-text-soft)]">
            {stats.todayMinutes} / {dailyGoal} min
          </span>
        </div>
        <div className="h-2.5 bg-[var(--color-gray-border)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${dailyPct}%`,
              background: dailyPct >= 100 ? '#67b31f' : 'var(--color-primary)',
            }}
          />
        </div>
        <p className="text-xs text-[var(--color-gray-mid)] text-right">{dailyPct}% completado</p>
      </div>

      {/* Weekly goal */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={15} className="text-[var(--color-primary)]" />
            <span className="text-sm font-medium text-[var(--color-text)]">Meta semanal</span>
          </div>
          <span className="text-sm text-[var(--color-text-soft)]">
            {stats.weekMinutes} / {weeklyGoal} min
          </span>
        </div>
        <div className="h-2.5 bg-[var(--color-gray-border)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${weeklyPct}%`,
              background: weeklyPct >= 100 ? '#67b31f' : 'var(--color-primary)',
            }}
          />
        </div>
        <p className="text-xs text-[var(--color-gray-mid)] text-right">{weeklyPct}% completado</p>
      </div>

      {/* Edit goals */}
      {editing ? (
        <div className="border border-[var(--color-gray-border)] rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-[var(--color-text)]">Editar metas</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--color-text-soft)] mb-1">
                Meta diaria (min)
              </label>
              <input
                type="number"
                min={5}
                max={480}
                value={tempDaily}
                onChange={(e) => setTempDaily(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-gray-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-soft)] mb-1">
                Meta semanal (min)
              </label>
              <input
                type="number"
                min={30}
                max={2400}
                value={tempWeekly}
                onChange={(e) => setTempWeekly(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-gray-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-60 transition-colors"
            >
              <Save size={14} />
              Guardar
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-[var(--color-gray-border)] text-[var(--color-text-soft)] rounded-lg hover:bg-[var(--color-gray-light)] transition-colors"
            >
              <X size={14} />
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 text-sm text-[var(--color-text-soft)] hover:text-[var(--color-primary)] transition-colors"
        >
          <Edit2 size={14} />
          Editar metas
        </button>
      )}
    </div>
  );
}
