'use client';

import { useState, useMemo } from 'react';
import { Flame, Target, CheckCircle2, Edit2, X, Save, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { updateGoalsAction, updatePomodoroAction } from '@/app/(app)/timer/actions';
import type { PomodoroSettings } from '@/lib/types';
import {
  onlyCompleted,
  minutesOnDay,
  minutesSinceMonday,
  currentStreak,
  type StatsSession,
} from '@/lib/stats';

interface Props {
  sessions: StatsSession[];
  dailyGoal: number;
  weeklyGoal: number;
  /** Ajustes del ciclo Pomodoro; los edita esta pestaña y los usa el reloj. */
  pomodoro: PomodoroSettings;
  onPomodoroChange: (settings: PomodoroSettings) => void;
}

/** Los cuatro campos del Pomodoro, con los rangos de `updatePomodoroSchema`. */
const POMODORO_FIELDS: {
  key: keyof PomodoroSettings;
  label: string;
  min: number;
  max: number;
}[] = [
  { key: 'focusMinutes', label: 'Foco (min)', min: 5, max: 90 },
  { key: 'breakMinutes', label: 'Descanso (min)', min: 1, max: 30 },
  { key: 'longBreakMinutes', label: 'Descanso largo (min)', min: 5, max: 60 },
  { key: 'cyclesBeforeLongBreak', label: 'Bloques por tanda', min: 2, max: 8 },
];

export function StudyGoals({
  sessions,
  dailyGoal: initialDaily,
  weeklyGoal: initialWeekly,
  pomodoro,
  onPomodoroChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [dailyGoal, setDailyGoal] = useState(initialDaily);
  const [weeklyGoal, setWeeklyGoal] = useState(initialWeekly);
  const [tempDaily, setTempDaily] = useState(initialDaily);
  const [tempWeekly, setTempWeekly] = useState(initialWeekly);
  const [saving, setSaving] = useState(false);
  const [editingPomodoro, setEditingPomodoro] = useState(false);
  const [tempPomodoro, setTempPomodoro] = useState(pomodoro);
  const [savingPomodoro, setSavingPomodoro] = useState(false);

  const stats = useMemo(() => {
    const now = new Date();
    const completed = onlyCompleted(sessions);

    return {
      todayMinutes: minutesOnDay(completed, now),
      // La meta semanal se compara contra la semana natural (desde el lunes),
      // no contra los últimos 7 días: es lo que espera quien se fija una meta.
      weekMinutes: minutesSinceMonday(completed, now),
      streak: currentStreak(completed, now),
    };
  }, [sessions]);

  async function handleSave() {
    setSaving(true);
    // Los rangos los comprueba updateGoalsSchema, que replica los CHECK de la
    // migración 003. Antes se validaban aquí a mano con los números repetidos.
    const result = await updateGoalsAction({
      daily_goal_minutes: tempDaily,
      weekly_goal_minutes: tempWeekly,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDailyGoal(result.data.daily_goal_minutes);
    setWeeklyGoal(result.data.weekly_goal_minutes);
    setEditing(false);
    toast.success('Metas actualizadas');
  }

  function handleCancel() {
    setTempDaily(dailyGoal);
    setTempWeekly(weeklyGoal);
    setEditing(false);
  }

  async function handleSavePomodoro() {
    setSavingPomodoro(true);
    const result = await updatePomodoroAction({
      pomodoro_focus_minutes: tempPomodoro.focusMinutes,
      pomodoro_break_minutes: tempPomodoro.breakMinutes,
      pomodoro_long_break_minutes: tempPomodoro.longBreakMinutes,
      pomodoro_cycles_before_long_break: tempPomodoro.cyclesBeforeLongBreak,
    });
    setSavingPomodoro(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    // El reloj vive en TimerClient: se le devuelve lo que confirmó el
    // servidor, no lo que se tecleó, para que ambos midan lo mismo.
    onPomodoroChange(result.data);
    setTempPomodoro(result.data);
    setEditingPomodoro(false);
    toast.success('Pomodoro actualizado');
  }

  const dailyPct = Math.min(100, Math.round((stats.todayMinutes / dailyGoal) * 100));
  const weeklyPct = Math.min(100, Math.round((stats.weekMinutes / weeklyGoal) * 100));

  return (
    <div className="space-y-5">
      {/* Streak banner */}
      <div className="flex items-center gap-3 bg-[var(--color-gray-light)] rounded-xl p-4">
        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center flex-shrink-0">
          <Flame size={20} className="text-orange-500 dark:text-orange-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">Racha actual</p>
          <p className="text-2xl font-bold text-orange-500 dark:text-orange-400">
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

      {/* Pomodoro (migración 009). El modo estaba retirado de la interfaz
          porque sus tiempos eran constantes en el cliente: 25/5 sirve para
          leer, no para resolver problemas. */}
      <div className="border-t border-[var(--color-gray-border)] pt-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Timer size={15} className="text-[var(--color-primary)]" />
            <span className="text-sm font-medium text-[var(--color-text)]">Ciclo Pomodoro</span>
          </div>
          {!editingPomodoro && (
            <button
              onClick={() => {
                setTempPomodoro(pomodoro);
                setEditingPomodoro(true);
              }}
              className="flex items-center gap-1.5 text-sm text-[var(--color-text-soft)] hover:text-[var(--color-primary)] transition-colors"
            >
              <Edit2 size={14} />
              Ajustar
            </button>
          )}
        </div>

        {editingPomodoro ? (
          <div className="border border-[var(--color-gray-border)] rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {POMODORO_FIELDS.map((field) => (
                <div key={field.key}>
                  <label
                    htmlFor={`pomodoro-${field.key}`}
                    className="block text-xs text-[var(--color-text-soft)] mb-1"
                  >
                    {field.label}
                  </label>
                  <input
                    id={`pomodoro-${field.key}`}
                    type="number"
                    min={field.min}
                    max={field.max}
                    value={tempPomodoro[field.key]}
                    onChange={(e) =>
                      setTempPomodoro((prev) => ({
                        ...prev,
                        [field.key]: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-gray-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSavePomodoro}
                disabled={savingPomodoro}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-60 transition-colors"
              >
                <Save size={14} />
                Guardar
              </button>
              <button
                onClick={() => {
                  setTempPomodoro(pomodoro);
                  setEditingPomodoro(false);
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-[var(--color-gray-border)] text-[var(--color-text-soft)] rounded-lg hover:bg-[var(--color-gray-light)] transition-colors"
              >
                <X size={14} />
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-soft)]">
            {pomodoro.focusMinutes} min de foco · {pomodoro.breakMinutes} min de descanso ·
            descanso largo de {pomodoro.longBreakMinutes} min cada{' '}
            {pomodoro.cyclesBeforeLongBreak} bloques.
          </p>
        )}
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
