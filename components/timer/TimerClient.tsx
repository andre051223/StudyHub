'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { Play, Pause, Square, PictureInPicture2 } from 'lucide-react';
import { MiniTimer } from './MiniTimer';
import { toast } from 'sonner';
import { createSessionAction } from '@/app/(app)/timer/actions';
import type { Category, StudySession, StudyMode, TimerState, TaskQuadrant } from '@/lib/types';
import type { StatsSession } from '@/lib/stats';
import { MIN_TIMER_MINUTES, MAX_TIMER_MINUTES } from '@/lib/models/SessionModel';
import { formatDuration, getCircumference } from '@/lib/utils';
import { SessionHistory } from './SessionHistory';
import { StudyStats } from './StudyStats';
import { StudyGoals } from './StudyGoals';

const STORAGE_KEY = 'studyhub_timer_state';
// Rango del selector de duración del temporizador (en minutos). Vive en el
// modelo para que la UI y la validación de servidor no puedan divergir.
const MIN_DURATION = MIN_TIMER_MINUTES;
const MAX_DURATION = MAX_TIMER_MINUTES;

/** Lo mínimo que necesita el selector de tareas del temporizador. */
export interface OpenTask {
  id: string;
  title: string;
  quadrant: TaskQuadrant;
  category_id: string | null;
}

/** Orden y etiquetas de los grupos del selector, de más a menos urgente. */
const TASK_GROUPS: { quadrant: TaskQuadrant; label: string }[] = [
  { quadrant: 'urgent_important', label: 'Hacer ahora' },
  { quadrant: 'not_urgent_important', label: 'Planificar' },
  { quadrant: 'urgent_not_important', label: 'Delegar' },
  { quadrant: 'not_urgent_not_important', label: 'Eliminar' },
];

const defaultState: TimerState = {
  isRunning: false,
  isPaused: false,
  mode: 'simple',
  durationMinutes: 25,
  categoryId: null,
  taskId: null,
  startedAt: null,
  pausedAt: null,
  totalPausedMs: 0,
  sessionId: null,
};

interface Props {
  categories: Category[];
  /** Historial completo, acotado a las 50 más recientes. */
  initialSessions: (StudySession & { category?: { name: string; color: string } | null })[];
  /** Sesiones completadas del último año, con las columnas mínimas para las estadísticas. */
  initialStatsSessions: StatsSession[];
  /** Tareas pendientes, para poder estudiar sobre una en concreto. */
  openTasks: OpenTask[];
  dailyGoal: number;
  weeklyGoal: number;
}

export function TimerClient({
  categories,
  initialSessions,
  initialStatsSessions,
  openTasks,
  dailyGoal,
  weeklyGoal,
}: Props) {
  const [state, setState] = useState<TimerState>(defaultState);
  const [secondsLeft, setSecondsLeft] = useState(defaultState.durationMinutes * 60);
  const [activeTab, setActiveTab] = useState<'history' | 'stats' | 'goals'>('history');
  const [sessions, setSessions] = useState(initialSessions);
  // Se mantiene aparte del historial para que las estadísticas sigan cubriendo
  // el año completo y a la vez se actualicen al guardar una sesión nueva.
  const [statsSessions, setStatsSessions] = useState(initialStatsSessions);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const savingRef = useRef(false);
  const stateRef = useRef(state);
  const pipRootRef = useRef<ReturnType<typeof ReactDOM.createRoot> | null>(null);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  // Keep stateRef in sync so async callbacks always see latest state
  useEffect(() => { stateRef.current = state; });

  // Misma técnica para la lista de tareas: el effect de hidratación necesita
  // consultarla, pero no debe volver a ejecutarse si cambia (rehidratar desde
  // localStorage a mitad de una sesión pisaría el estado en curso).
  const openTasksRef = useRef(openTasks);
  useEffect(() => { openTasksRef.current = openTasks; });

  // Load persisted state on mount (client only). Se hace en un effect, y no en
  // un inicializador lazy de useState, para que el render del servidor y el
  // primer render del cliente coincidan (localStorage no existe en SSR) y no se
  // produzca un mismatch de hidratación.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as TimerState;
        // Estados guardados antes de retirar el modo Pomodoro.
        if ((parsed.mode as string) === 'pomodoro') parsed.mode = 'simple';
        // Estados guardados antes de que existiera la tarea asociada, y
        // tareas que ya no están pendientes: la referencia se descarta en vez
        // de guardar una sesión apuntando a algo que ya no existe.
        parsed.taskId =
          parsed.taskId && openTasksRef.current.some((t) => t.id === parsed.taskId)
            ? parsed.taskId
            : null;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage
        setState(parsed);
      }
    } catch {}
  }, []);

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Compute elapsed seconds since the timer started (used by the stopwatch
  // and to derive the remaining time for the countdown).
  const computeElapsedSeconds = useCallback((s: TimerState): number => {
    if (!s.isRunning && !s.isPaused) return 0;
    const now = s.isPaused ? s.pausedAt! : Date.now();
    return Math.max(0, Math.floor((now - s.startedAt! - s.totalPausedMs) / 1000));
  }, []);

  // Compute seconds left from timestamps (countdown mode only)
  const computeSecondsLeft = useCallback(
    (s: TimerState): number => {
      if (!s.isRunning && !s.isPaused) return s.durationMinutes * 60;
      return Math.max(0, s.durationMinutes * 60 - computeElapsedSeconds(s));
    },
    [computeElapsedSeconds]
  );

  // `handleComplete` se recrea en cada render, pero el intervalo no debe
  // reiniciarse por eso: se invoca a través de un ref para que las
  // dependencias del effect sean solo los campos del temporizador que sí
  // justifican reprogramarlo.
  const handleCompleteRef = useRef(handleComplete);
  useEffect(() => { handleCompleteRef.current = handleComplete; });

  // Etiqueta del modo. Declarada aquí arriba porque el effect de la ventana
  // flotante la lista entre sus dependencias, y un `const` posterior estaría
  // en zona muerta temporal al evaluarse el array.
  const phaseLabel = state.mode === 'stopwatch' ? 'Cronómetro' : 'Temporizador';

  // Tick. `secondsLeft` holds the value shown on screen: remaining seconds for
  // the countdown, elapsed seconds for the stopwatch.
  useEffect(() => {
    const tick = (s: TimerState) =>
      s.mode === 'stopwatch' ? computeElapsedSeconds(s) : computeSecondsLeft(s);

    if (state.isRunning && !state.isPaused) {
      tickRef.current = setInterval(() => {
        const value = tick(stateRef.current);
        setSecondsLeft(value);
        // The stopwatch counts up with no target, so it never auto-completes.
        if (stateRef.current.mode !== 'stopwatch' && value <= 0 && !savingRef.current) {
          savingRef.current = true;
          handleCompleteRef.current().finally(() => { savingRef.current = false; });
        }
      }, 500);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
      // stateRef ya está sincronizado: su effect se declara antes que este.
      setSecondsLeft(tick(stateRef.current));
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [
    state.isRunning,
    state.isPaused,
    state.startedAt,
    state.durationMinutes,
    state.mode,
    computeElapsedSeconds,
    computeSecondsLeft,
  ]);

  async function openPiP() {
    if (!('documentPictureInPicture' in window)) {
      toast.error('Tu navegador no soporta la ventana flotante. Usa Chrome o Edge 116+.');
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pip: Window = await (window as any).documentPictureInPicture.requestWindow({
        width: 280,
        height: 200,
        disallowReturnToOpener: false,
      });

      // Reset de la ventana flotante + copia de las variables de tema actuales
      // para que el MiniTimer herede los colores (incluido el modo oscuro) y su
      // contenido escale al redimensionar la ventana.
      const theme = document.documentElement.dataset.theme ?? 'light';
      const root = getComputedStyle(document.documentElement);
      const vars = ['--color-surface', '--color-text', '--color-text-soft', '--color-gray-border']
        .map((v) => `${v}: ${root.getPropertyValue(v).trim()};`)
        .join(' ');
      const style = pip.document.createElement('style');
      style.textContent = `
        html, body { margin: 0; height: 100%; overflow: hidden; }
        body { ${vars} }
      `;
      pip.document.head.appendChild(style);
      pip.document.documentElement.dataset.theme = theme;

      pip.addEventListener('pagehide', () => setPipWindow(null));
      setPipWindow(pip);
    } catch {
      toast.error('No se pudo abrir la ventana flotante');
    }
  }

  // Los controles del MiniTimer se recrean en cada render. Envolverlos en
  // callbacks estables evita que la ventana flotante se vuelva a renderizar
  // solo porque cambió la identidad de una función.
  const handlersRef = useRef({ handleStart, handlePause, handleResume, handleStop });
  useEffect(() => {
    handlersRef.current = { handleStart, handlePause, handleResume, handleStop };
  });
  const pipHandlers = useRef({
    onStart: () => handlersRef.current.handleStart(),
    onPause: () => handlersRef.current.handlePause(),
    onResume: () => handlersRef.current.handleResume(),
    onStop: () => handlersRef.current.handleStop(),
  }).current;

  // Sync mini timer into PiP window
  useEffect(() => {
    if (!pipWindow) return;
    if (!pipRootRef.current) {
      pipRootRef.current = ReactDOM.createRoot(pipWindow.document.body);
    }
    pipRootRef.current.render(
      <MiniTimer
        secondsLeft={secondsLeft}
        phaseLabel={phaseLabel}
        isRunning={state.isRunning}
        isPaused={state.isPaused}
        onPause={pipHandlers.onPause}
        onResume={pipHandlers.onResume}
        onStop={pipHandlers.onStop}
        onStart={pipHandlers.onStart}
      />
    );
  }, [pipWindow, secondsLeft, state.isRunning, state.isPaused, phaseLabel, pipHandlers]);

  // Clean up PiP root when window closes
  useEffect(() => {
    if (!pipWindow) {
      pipRootRef.current = null;
    }
  }, [pipWindow]);

  function playBell() {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/bell.wav');
      }
      audioRef.current.play().catch(() => {
        // Fallback to Web Audio API
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 1.5);
      });
    } catch {}
  }

  function sendBrowserNotification(message: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('StudyHub', { body: message, icon: '/favicon.ico' });
    }
  }

  async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  async function handleComplete() {
    const s = stateRef.current;
    playBell();
    sendBrowserNotification('¡Sesión completada! Tiempo de descansar.');
    await saveSession(true);
    setState({
      ...defaultState,
      mode: s.mode,
      durationMinutes: s.durationMinutes,
      categoryId: s.categoryId,
      taskId: s.taskId,
    });
    toast.success('¡Sesión completada!');
  }

  async function saveSession(completed: boolean) {
    const s = stateRef.current;
    // Tiempo realmente estudiado. En el cronómetro no hay duración planeada,
    // así que se usa el tiempo transcurrido directamente.
    const actual = Math.max(
      0,
      s.mode === 'stopwatch'
        ? computeElapsedSeconds(s)
        : s.durationMinutes * 60 - computeSecondsLeft(s)
    );
    // Por Server Action: SessionModel valida el rango según el modo (10–120
    // solo para el temporizador, sin techo para el cronómetro) y que el tiempo
    // transcurrido no sea negativo. Insertando directo nada de eso corría.
    const result = await createSessionAction({
      category_id: s.categoryId,
      task_id: s.taskId,
      // El cronómetro no tiene duración planeada: se guarda null. Antes se
      // escribía Math.round(actual / 60), que rompía el CHECK de la base
      // tanto por arriba (más de 2 h) como por abajo (menos de 30 s → 0), y
      // la sesión se perdía con un toast de error.
      duration_minutes: s.mode === 'stopwatch' ? null : s.durationMinutes,
      actual_duration_seconds: actual,
      mode: s.mode,
      pomodoro_cycles_completed: 0,
      started_at: new Date(s.startedAt!).toISOString(),
      completed_at: completed ? new Date().toISOString() : null,
    });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    const saved = result.data as typeof sessions[0];
    setSessions((prev) => [saved, ...prev]);
    // Solo las completadas alimentan las estadísticas.
    if (saved.completed_at) {
      setStatsSessions((prev) => [saved as StatsSession, ...prev]);
    }
  }

  async function handleStart() {
    await requestNotificationPermission();
    setState((prev) => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      startedAt: Date.now(),
      totalPausedMs: 0,
    }));
  }

  function handlePause() {
    setState((prev) => ({ ...prev, isPaused: true, pausedAt: Date.now() }));
  }

  function handleResume() {
    setState((prev) => ({
      ...prev,
      isPaused: false,
      totalPausedMs: prev.totalPausedMs + (Date.now() - (prev.pausedAt ?? Date.now())),
      pausedAt: null,
    }));
  }

  async function handleStop() {
    const s = stateRef.current;
    if (s.startedAt) await saveSession(false);
    setState({
      ...defaultState,
      mode: s.mode,
      durationMinutes: s.durationMinutes,
      categoryId: s.categoryId,
      taskId: s.taskId,
    });
    toast.info('Sesión detenida');
  }

  const isStopwatch = state.mode === 'stopwatch';
  const totalDuration = state.durationMinutes * 60;
  const displaySeconds = isStopwatch
    ? secondsLeft // tiempo transcurrido
    : (!state.isRunning && !state.isPaused)
    ? totalDuration
    : secondsLeft;
  // Relleno del anillo:
  // - Cronómetro: sin meta fija, el anillo se muestra completo.
  // - Temporizador en reposo: refleja la duración elegida con el slider
  //   (proporción sobre el máximo de 120 min).
  // - Temporizador en marcha: avance de la sesión.
  const progress = isStopwatch
    ? 1
    : !state.isRunning && !state.isPaused
    ? state.durationMinutes / MAX_DURATION
    : totalDuration > 0
    ? (totalDuration - displaySeconds) / totalDuration
    : 0;
  const radius = 88;
  const circumference = getCircumference(radius);
  const strokeDashoffset = circumference * (1 - progress);


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
                  stroke="var(--color-primary)"
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

            {/* Controls */}
            <div className="flex items-center gap-3">
              {!state.isRunning ? (
                <button
                  onClick={handleStart}
                  className="flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white font-semibold rounded-xl hover:bg-[var(--color-primary-dark)] transition-all hover:-translate-y-0.5"
                >
                  <Play size={18} />
                  Iniciar
                </button>
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
                  {!pipWindow && (
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
                {(['simple', 'stopwatch'] as StudyMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => !state.isRunning && setState((prev) => ({ ...prev, mode: m }))}
                    disabled={state.isRunning}
                    className={`px-5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                      state.mode === m
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'text-[var(--color-text-soft)] hover:bg-[var(--color-gray-light)]'
                    }`}
                  >
                    {m === 'simple' ? 'Temporizador' : 'Cronómetro'}
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

      {/* History / Stats */}
      <div className="bg-[var(--color-surface)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
        <div className="flex border-b border-[var(--color-gray-border)]">
          {(['history', 'stats', 'goals'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                  : 'text-[var(--color-text-soft)] hover:text-[var(--color-text)]'
              }`}
            >
              {tab === 'history' ? 'Historial' : tab === 'stats' ? 'Estadísticas' : 'Rachas'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'history' ? (
            <SessionHistory sessions={sessions} />
          ) : activeTab === 'stats' ? (
            <StudyStats sessions={statsSessions} />
          ) : (
            <StudyGoals sessions={statsSessions} dailyGoal={dailyGoal} weeklyGoal={weeklyGoal} />
          )}
        </div>
      </div>
    </div>
  );
}
