'use client';

import { memo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Pause, Square, PictureInPicture2, Target, X, Coffee, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import { updateSessionAction } from '@/app/(app)/timer/actions';
import type { Category, OpenTask, PomodoroSettings, StudySession, TaskQuadrant } from '@/lib/types';
import { formatMinutes, type FocusRatingKey, type StatsSession } from '@/lib/stats';
import { MIN_TIMER_MINUTES, MAX_TIMER_MINUTES } from '@/lib/models/SessionModel';
import { formatDuration, getCircumference } from '@/lib/utils';
import { SessionHistory } from './SessionHistory';
import { SessionForm } from './SessionForm';
import { StudyStats } from './StudyStats';
import { StudyGoals } from './StudyGoals';
import { FocusRatingPicker } from './focusRating';
import { useTimer, useTimerClock } from './TimerProvider';

// Rango del selector de duración del temporizador (en minutos). Vive en el
// modelo para que la UI y la validación de servidor no puedan divergir.
const MIN_DURATION = MIN_TIMER_MINUTES;
const MAX_DURATION = MAX_TIMER_MINUTES;

/** Sesión del historial: la fila completa más la categoría incrustada. */
type HistorySession = StudySession & { category?: { name: string; color: string } | null };

/** Orden y etiquetas de los grupos del selector, de más a menos urgente. */
const TASK_GROUPS: { quadrant: TaskQuadrant; label: string }[] = [
  { quadrant: 'urgent_important', label: 'Hacer ahora' },
  { quadrant: 'not_urgent_important', label: 'Planificar' },
  { quadrant: 'urgent_not_important', label: 'Delegar' },
  { quadrant: 'not_urgent_not_important', label: 'Eliminar' },
];

const MODE_LABELS: Record<'simple' | 'stopwatch' | 'pomodoro', string> = {
  simple: 'Temporizador',
  stopwatch: 'Cronómetro',
  pomodoro: 'Pomodoro',
};

/** Proyección de una sesión completa a la forma mínima de las estadísticas. */
function toStatsSession(s: StudySession): StatsSession {
  return {
    id: s.id,
    started_at: s.started_at,
    actual_duration_seconds: s.actual_duration_seconds,
    completed_at: s.completed_at,
    category_id: s.category_id,
    category: s.category ? { name: s.category.name, color: s.category.color } : null,
    focus_rating: s.focus_rating,
  };
}

const byStartedAtDesc = (a: { started_at: string }, b: { started_at: string }) =>
  new Date(b.started_at).getTime() - new Date(a.started_at).getTime();

interface Props {
  categories: Category[];
  /** Historial completo, acotado a las 50 más recientes. */
  initialSessions: HistorySession[];
  /** Sesiones completadas del último año, con las columnas mínimas para las estadísticas. */
  initialStatsSessions: StatsSession[];
  /** Tareas pendientes, para poder estudiar sobre una en concreto. */
  openTasks: OpenTask[];
  dailyGoal: number;
  weeklyGoal: number;
}

/**
 * Pantalla de /timer. El reloj en sí (estado, latido, guardado, ventana
 * flotante) vive en `TimerProvider`, montado en el layout de (app), para que
 * siga corriendo al navegar por el resto de la app. Este componente es solo
 * la vista completa más el historial, las estadísticas y las metas.
 */
export function TimerClient({
  categories,
  initialSessions,
  initialStatsSessions,
  openTasks,
  dailyGoal,
  weeklyGoal,
}: Props) {
  const {
    state,
    setState,
    totalDuration,
    phaseLabel,
    awaitingBreak,
    startLabel,
    pomodoro,
    setPomodoro,
    pendingRating,
    setPendingRating,
    pipOpen,
    openPiP,
    start: handleStart,
    pause: handlePause,
    resume: handleResume,
    stop: handleStop,
    skipBreak: handleSkipBreak,
    changeMode: handleModeChange,
    onSessionSaved,
  } = useTimer();
  const secondsLeft = useTimerClock();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TimerTab>('history');
  const [sessions, setSessions] = useState(initialSessions);
  // Se mantiene aparte del historial para que las estadísticas sigan cubriendo
  // el año completo y a la vez se actualicen al guardar una sesión nueva.
  const [statsSessions, setStatsSessions] = useState(initialStatsSessions);
  // `undefined` = formulario cerrado; `null` = alta manual; objeto = edición.
  const [editing, setEditing] = useState<StudySession | null | undefined>(undefined);

  // Tareas que ya no están pendientes (o que se borraron): la referencia se
  // descarta en vez de guardar una sesión apuntando a algo que ya no existe.
  // Con el reloj en marcha no se toca: la sesión en curso es de esa tarea.
  useEffect(() => {
    if (state.isRunning || !state.taskId) return;
    if (openTasks.some((t) => t.id === state.taskId)) return;
    setState((prev) => ({ ...prev, taskId: null }));
  }, [openTasks, state.isRunning, state.taskId, setState]);

  // ── Reconciliación de las dos listas ────────────────────────
  //
  // El historial y las estadísticas se mantienen por separado (50 filas
  // completas frente a un año de filas mínimas), así que toda escritura tiene
  // que aplicarse a ambas. Se ordena por fecha porque una sesión registrada a
  // mano puede ser de la semana pasada y no debe colarse arriba del todo.

  const applySavedSession = useCallback((saved: StudySession) => {
    setSessions((prev) => {
      const next = prev.some((s) => s.id === saved.id)
        ? prev.map((s) => (s.id === saved.id ? (saved as HistorySession) : s))
        : [saved as HistorySession, ...prev];
      return [...next].sort(byStartedAtDesc);
    });

    setStatsSessions((prev) => {
      // Solo las completadas alimentan las estadísticas; si una sesión deja de
      // estarlo al editarla, tiene que desaparecer de ellas.
      const without = prev.filter((s) => s.id !== saved.id);
      if (!saved.completed_at) return without;
      return [toStatsSession(saved), ...without].sort(byStartedAtDesc);
    });
  }, []);

  // Las sesiones que guarda el reloj (el proveedor) entran en las listas de
  // esta pantalla. Las que se guardan estando en otra página llegan con el
  // fetch del servidor al volver a /timer.
  //
  // El refresco del servidor va aparte y sin esperar a nadie: el guardado ya
  // no revalida la página (hacía lento "Detener"), pero el tiempo acumulado de
  // las tareas del selector sí se calcula en el servidor.
  useEffect(
    () =>
      onSessionSaved((saved) => {
        applySavedSession(saved);
        router.refresh();
      }),
    [onSessionSaved, applySavedSession, router]
  );

  const openNewSession = useCallback(() => setEditing(null), []);

  function removeSession(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setStatsSessions((prev) => prev.filter((s) => s.id !== id));
    setPendingRating((prev) => (prev?.id === id ? null : prev));
  }

  async function handleRate(rating: FocusRatingKey | null) {
    const session = pendingRating;
    if (!session || !rating) {
      setPendingRating(null);
      return;
    }
    setPendingRating(null);

    const result = await updateSessionAction(session.id, { focus_rating: rating });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    applySavedSession(result.data);
  }

  const isStopwatch = state.mode === 'stopwatch';
  const isPomodoro = state.mode === 'pomodoro';
  const isRest = isPomodoro && state.phase !== 'focus';
  const idle = !state.isRunning && !state.isPaused;
  const displaySeconds = isStopwatch
    ? secondsLeft // tiempo transcurrido
    : idle
    ? totalDuration
    : secondsLeft;
  // Relleno del anillo:
  // - Cronómetro: sin meta fija, el anillo se muestra completo.
  // - Temporizador en reposo: refleja la duración elegida con el slider
  //   (proporción sobre el máximo de 120 min).
  // - Pomodoro en reposo: vacío, porque la fase aún no ha empezado.
  // - En marcha: avance del tramo.
  const progress = isStopwatch
    ? 1
    : idle
    ? isPomodoro
      ? 0
      : state.durationMinutes / MAX_DURATION
    : totalDuration > 0
    ? (totalDuration - displaySeconds) / totalDuration
    : 0;
  const radius = 88;
  const circumference = getCircumference(radius);
  const strokeDashoffset = circumference * (1 - progress);

  // Contraste entre lo estimado y lo llevado en la tarea elegida (migración
  // 009). Se suma el tiempo del tramo en curso —sin contar descansos— para
  // que el aviso llegue mientras aún se puede reaccionar, y no al día
  // siguiente al abrir el Kanban.
  const selectedTask = openTasks.find((t) => t.id === state.taskId) ?? null;
  const liveSeconds = idle || isRest ? 0 : isStopwatch ? secondsLeft : totalDuration - secondsLeft;
  const taskProgress =
    selectedTask?.estimated_minutes != null
      ? (() => {
          const done = Math.round((selectedTask.studied_seconds + Math.max(0, liveSeconds)) / 60);
          const estimate = selectedTask.estimated_minutes!;
          return { done, estimate, pct: Math.round((done / estimate) * 100) };
        })()
      : null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Timer card */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-8 shadow-[var(--shadow-card)] mb-6">
        <div className="flex flex-col lg:flex-row gap-8 items-center">
          {/* Circular timer */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <svg width="220" height="220" className="-rotate-90">
                <circle
                  cx="110"
                  cy="110"
                  r={radius}
                  fill="none"
                  stroke="var(--color-gray-border)"
                  strokeWidth="10"
                />
                <circle
                  cx="110"
                  cy="110"
                  r={radius}
                  fill="none"
                  // Los descansos se pintan en gris: el verde de marca señala
                  // el tiempo que cuenta como estudio.
                  stroke={isRest ? 'var(--color-gray-mid)' : 'var(--color-primary)'}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-[var(--color-text)] tabular-nums">
                  {formatDuration(displaySeconds)}
                </span>
                <span className="text-sm text-[var(--color-text-soft)] mt-1">{phaseLabel}</span>
              </div>
            </div>

            {/* Bloques completados en la tanda actual. */}
            {isPomodoro && (
              <div
                className="flex items-center gap-1.5"
                aria-label={`${state.cyclesDone} de ${pomodoro.cyclesBeforeLongBreak} bloques completados`}
              >
                {Array.from({ length: pomodoro.cyclesBeforeLongBreak }, (_, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i < state.cyclesDone % pomodoro.cyclesBeforeLongBreak ||
                      (state.cyclesDone > 0 && state.cyclesDone % pomodoro.cyclesBeforeLongBreak === 0)
                        ? 'bg-[var(--color-primary)]'
                        : 'bg-[var(--color-gray-border)]'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-3">
              {!state.isRunning ? (
                <>
                  <button
                    onClick={handleStart}
                    className="flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white font-semibold rounded-xl hover:bg-[var(--color-primary-dark)] transition-all hover:-translate-y-0.5"
                  >
                    {awaitingBreak ? <Coffee size={18} /> : <Play size={18} />}
                    {startLabel}
                  </button>
                  {awaitingBreak && (
                    <button
                      onClick={handleSkipBreak}
                      className="flex items-center gap-2 px-5 py-3 border border-[var(--color-gray-border)] text-[var(--color-text-soft)] font-medium rounded-xl hover:bg-[var(--color-gray-light)] transition-colors"
                    >
                      <SkipForward size={16} />
                      Siguiente bloque
                    </button>
                  )}
                </>
              ) : (
                <>
                  {state.isPaused ? (
                    <button
                      onClick={handleResume}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white font-medium rounded-xl hover:bg-[var(--color-primary-dark)] transition-colors"
                    >
                      <Play size={16} />
                      Reanudar
                    </button>
                  ) : (
                    <button
                      onClick={handlePause}
                      className="flex items-center gap-2 px-5 py-2.5 border border-[var(--color-gray-border)] text-[var(--color-text-soft)] font-medium rounded-xl hover:bg-[var(--color-gray-light)] transition-colors"
                    >
                      <Pause size={16} />
                      Pausar
                    </button>
                  )}
                  <button
                    onClick={handleStop}
                    className="flex items-center gap-2 px-4 py-2.5 border border-[var(--color-gray-border)] text-[var(--color-text-soft)] font-medium rounded-xl hover:bg-red-50 dark:hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-500/30 transition-colors"
                  >
                    <Square size={16} />
                    Detener
                  </button>
                  {!pipOpen && (
                    <button
                      onClick={openPiP}
                      title="Ventana flotante"
                      className="flex items-center gap-2 px-3 py-2.5 border border-[var(--color-gray-border)] text-[var(--color-text-soft)] font-medium rounded-xl hover:bg-[var(--color-gray-light)] transition-colors"
                    >
                      <PictureInPicture2 size={16} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Settings */}
          <div className="flex-1 space-y-5">
            {/* Mode toggle */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Modo
              </label>
              <div className="flex rounded-xl border border-[var(--color-gray-border)] overflow-hidden w-fit">
                {(['simple', 'stopwatch', 'pomodoro'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => handleModeChange(m)}
                    disabled={state.isRunning}
                    className={`px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                      state.mode === m
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'text-[var(--color-text-soft)] hover:bg-[var(--color-gray-light)]'
                    }`}
                  >
                    {MODE_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration (only countdown mode) */}
            {state.mode === 'simple' && (
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Duración: <span className="text-[var(--color-primary)]">{state.durationMinutes} min</span>
                </label>
                <input
                  type="range"
                  min={MIN_DURATION}
                  max={MAX_DURATION}
                  step={5}
                  value={state.durationMinutes}
                  disabled={state.isRunning}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, durationMinutes: Number(e.target.value) }))
                  }
                  className="w-full accent-[var(--color-primary)]"
                />
                <div className="flex justify-between text-xs text-[var(--color-gray-mid)] mt-1">
                  <span>{MIN_DURATION} min</span>
                  <span>{MAX_DURATION} min</span>
                </div>
              </div>
            )}

            {isStopwatch && (
              <div className="bg-[var(--color-gray-light)] rounded-xl p-4 text-sm text-[var(--color-text-soft)]">
                <p className="font-medium text-[var(--color-text)] mb-1">Cronómetro</p>
                <p>Cuenta el tiempo hacia arriba, sin límite.</p>
                <p>Pulsa &quot;Detener&quot; para guardar la sesión.</p>
              </div>
            )}

            {isPomodoro && (
              <div className="bg-[var(--color-gray-light)] rounded-xl p-4 text-sm text-[var(--color-text-soft)]">
                <p className="font-medium text-[var(--color-text)] mb-1">Pomodoro</p>
                <p>
                  {pomodoro.focusMinutes} min de foco y {pomodoro.breakMinutes} de descanso;
                  cada {pomodoro.cyclesBeforeLongBreak} bloques, {pomodoro.longBreakMinutes} min
                  largos. Al terminar cada bloque eliges si descansar o pasar al siguiente.
                </p>
                <button
                  onClick={() => setActiveTab('goals')}
                  className="mt-1.5 text-[var(--color-primary)] hover:underline"
                >
                  Ajustar duraciones
                </button>
              </div>
            )}

            {/* Tarea sobre la que se estudia (migración 006). Elegir una
                hereda su categoría: casi siempre es la que corresponde, y
                evita tener que rellenar dos selectores para lo mismo. */}
            <div>
              <label
                htmlFor="timer-task"
                className="block text-sm font-medium text-[var(--color-text)] mb-2"
              >
                Tarea
              </label>
              <select
                id="timer-task"
                value={state.taskId ?? ''}
                disabled={state.isRunning}
                onChange={(e) => {
                  const taskId = e.target.value || null;
                  const task = openTasks.find((t) => t.id === taskId);
                  setState((prev) => ({
                    ...prev,
                    taskId,
                    categoryId: task?.category_id ?? prev.categoryId,
                  }));
                }}
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-gray-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-60 transition-all"
              >
                <option value="">Sin tarea concreta</option>
                {TASK_GROUPS.map(({ quadrant, label }) => {
                  const group = openTasks.filter((t) => t.quadrant === quadrant);
                  if (group.length === 0) return null;
                  return (
                    <optgroup key={quadrant} label={label}>
                      {group.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>

              {taskProgress && (
                <div className="mt-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 text-[var(--color-text-soft)]">
                      <Target size={12} className="text-[var(--color-primary)]" />
                      {formatMinutes(taskProgress.done)} de {formatMinutes(taskProgress.estimate)}{' '}
                      estimados
                    </span>
                    <span
                      className={`tabular-nums font-medium ${
                        taskProgress.pct > 100
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-[var(--color-text-soft)]'
                      }`}
                    >
                      {taskProgress.pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-[var(--color-gray-border)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, taskProgress.pct)}%`,
                        background:
                          taskProgress.pct > 100 ? '#f59e0b' : 'var(--color-primary)',
                      }}
                    />
                  </div>
                  {taskProgress.pct > 100 && (
                    <p className="text-meta mt-1 text-amber-600 dark:text-amber-400">
                      Llevas {formatMinutes(taskProgress.done - taskProgress.estimate)} más de lo
                      estimado.
                    </p>
                  )}
                </div>
              )}

              {openTasks.length === 0 && (
                <p className="text-meta mt-1.5">
                  Cuando tengas tareas pendientes podrás estudiar sobre una y ver
                  el tiempo acumulado en su tarjeta.
                </p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Materia / Categoría
              </label>
              <select
                value={state.categoryId ?? ''}
                disabled={state.isRunning}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, categoryId: e.target.value || null }))
                }
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-gray-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-60 transition-all"
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ¿Cómo fue? Se pregunta una vez, al terminar, y se puede omitir: una
          calificación forzada es una calificación falsa. */}
      {pendingRating && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-[var(--color-surface)] rounded-2xl p-4 shadow-[var(--shadow-card)] mb-6">
          <p className="text-sm font-medium text-[var(--color-text)] flex-shrink-0">
            ¿Cómo te fue en esta sesión?
          </p>
          <div className="flex-1">
            <FocusRatingPicker value={null} onChange={handleRate} clearable={false} />
          </div>
          <button
            onClick={() => setPendingRating(null)}
            aria-label="Omitir la calificación"
            className="flex items-center gap-1 px-2 py-1 text-sm text-[var(--color-text-soft)] hover:text-[var(--color-text)] transition-colors flex-shrink-0"
          >
            <X size={14} />
            Omitir
          </button>
        </div>
      )}

      {/* History / Stats */}
      <TimerTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sessions={sessions}
        statsSessions={statsSessions}
        dailyGoal={dailyGoal}
        weeklyGoal={weeklyGoal}
        pomodoro={pomodoro}
        onPomodoroChange={setPomodoro}
        onCreate={openNewSession}
        onEdit={setEditing}
      />

      {editing !== undefined && (
        <SessionForm
          session={editing}
          categories={categories}
          tasks={openTasks}
          onClose={() => setEditing(undefined)}
          onSaved={applySavedSession}
          onDeleted={removeSession}
        />
      )}
    </div>
  );
}

type TimerTab = 'history' | 'stats' | 'goals';

interface TimerTabsProps {
  activeTab: TimerTab;
  onTabChange: (tab: TimerTab) => void;
  sessions: HistorySession[];
  statsSessions: StatsSession[];
  dailyGoal: number;
  weeklyGoal: number;
  pomodoro: PomodoroSettings;
  onPomodoroChange: (settings: PomodoroSettings) => void;
  onCreate: () => void;
  onEdit: (session: StudySession) => void;
}

/**
 * Historial, estadísticas y metas. Va memoizado porque `TimerClient` se
 * re-renderiza cada segundo con el reloj en marcha, y estas pestañas (gráficos
 * incluidos) no dependen del segundero: re-pintarlas cada segundo competía en
 * el hilo principal con los clics de los controles.
 */
const TimerTabs = memo(function TimerTabs({
  activeTab,
  onTabChange,
  sessions,
  statsSessions,
  dailyGoal,
  weeklyGoal,
  pomodoro,
  onPomodoroChange,
  onCreate,
  onEdit,
}: TimerTabsProps) {
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
      <div className="flex border-b border-[var(--color-gray-border)]">
        {(['history', 'stats', 'goals'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                : 'text-[var(--color-text-soft)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab === 'history' ? 'Historial' : tab === 'stats' ? 'Estadísticas' : 'Metas'}
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === 'history' ? (
          <SessionHistory sessions={sessions} onCreate={onCreate} onEdit={onEdit} />
        ) : activeTab === 'stats' ? (
          <StudyStats sessions={statsSessions} />
        ) : (
          <StudyGoals
            sessions={statsSessions}
            dailyGoal={dailyGoal}
            weeklyGoal={weeklyGoal}
            pomodoro={pomodoro}
            onPomodoroChange={onPomodoroChange}
          />
        )}
      </div>
    </div>
  );
});
