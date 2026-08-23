'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { Play, Pause, Square, PictureInPicture2, Target, X } from 'lucide-react';
import { MiniTimer } from './MiniTimer';
import { toast } from 'sonner';
import { createSessionAction, updateSessionAction } from '@/app/(app)/timer/actions';
import type {
  Category,
  OpenTask,
  PomodoroSettings,
  StudySession,
  StudyMode,
  TimerState,
  TaskQuadrant,
} from '@/lib/types';
import { formatMinutes, type FocusRatingKey, type StatsSession } from '@/lib/stats';
import { MIN_TIMER_MINUTES, MAX_TIMER_MINUTES } from '@/lib/models/SessionModel';
import { formatDuration, getCircumference } from '@/lib/utils';
import { SessionHistory } from './SessionHistory';
import { SessionForm } from './SessionForm';
import { StudyStats } from './StudyStats';
import { StudyGoals } from './StudyGoals';
import { FocusRatingPicker } from './focusRating';

const STORAGE_KEY = 'studyhub_timer_state';
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
  phase: 'focus',
  cyclesDone: 0,
};

/**
 * Minutos que dura el tramo en curso.
 *
 * En Pomodoro la duración no la fija el usuario en un slider sino la fase, así
 * que `durationMinutes` deja de ser la fuente de verdad y todo el reloj
 * —cuenta atrás, anillo y guardado— tiene que preguntar por aquí.
 */
function phaseMinutes(s: TimerState, p: PomodoroSettings): number {
  if (s.mode !== 'pomodoro') return s.durationMinutes;
  if (s.phase === 'focus') return p.focusMinutes;
  return s.phase === 'long_break' ? p.longBreakMinutes : p.breakMinutes;
}

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
  pomodoro: PomodoroSettings;
}

export function TimerClient({
  categories,
  initialSessions,
  initialStatsSessions,
  openTasks,
  dailyGoal,
  weeklyGoal,
  pomodoro: initialPomodoro,
}: Props) {
  const [state, setState] = useState<TimerState>(defaultState);
  const [secondsLeft, setSecondsLeft] = useState(defaultState.durationMinutes * 60);
  const [activeTab, setActiveTab] = useState<'history' | 'stats' | 'goals'>('history');
  const [sessions, setSessions] = useState(initialSessions);
  // Se mantiene aparte del historial para que las estadísticas sigan cubriendo
  // el año completo y a la vez se actualicen al guardar una sesión nueva.
  const [statsSessions, setStatsSessions] = useState(initialStatsSessions);
  const [pomodoro, setPomodoro] = useState(initialPomodoro);
  // Sesión recién completada, a la espera de que el usuario diga cómo le fue.
  const [pendingRating, setPendingRating] = useState<StudySession | null>(null);
  // `undefined` = formulario cerrado; `null` = alta manual; objeto = edición.
  const [editing, setEditing] = useState<StudySession | null | undefined>(undefined);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const savingRef = useRef(false);
  const stateRef = useRef(state);
  const pipRootRef = useRef<ReturnType<typeof ReactDOM.createRoot> | null>(null);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  // Keep stateRef in sync so async callbacks always see latest state
  useEffect(() => { stateRef.current = state; });

  // Misma técnica para los ajustes del Pomodoro: los cambia la pestaña de
  // metas mientras el reloj puede estar corriendo, y los callbacks asíncronos
  // del ciclo tienen que ver siempre el último valor.
  const pomodoroRef = useRef(pomodoro);
  useEffect(() => { pomodoroRef.current = pomodoro; });

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
        // Estados guardados antes de que el Pomodoro tuviera fases propias.
        parsed.phase = parsed.phase ?? 'focus';
        parsed.cyclesDone = parsed.cyclesDone ?? 0;
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

  // Compute seconds left from timestamps (countdown modes only)
  const computeSecondsLeft = useCallback(
    (s: TimerState): number => {
      const total = phaseMinutes(s, pomodoroRef.current) * 60;
      if (!s.isRunning && !s.isPaused) return total;
      return Math.max(0, total - computeElapsedSeconds(s));
    },
    [computeElapsedSeconds]
  );

  // `handleComplete` se recrea en cada render, pero el intervalo no debe
  // reiniciarse por eso: se invoca a través de un ref para que las
  // dependencias del effect sean solo los campos del temporizador que sí
  // justifican reprogramarlo.
  const handleCompleteRef = useRef(handleComplete);
  useEffect(() => { handleCompleteRef.current = handleComplete; });

  // Etiqueta del tramo en curso. Declarada aquí arriba porque el effect de la
  // ventana flotante la lista entre sus dependencias, y un `const` posterior
  // estaría en zona muerta temporal al evaluarse el array.
  const phaseLabel =
    state.mode === 'stopwatch'
      ? 'Cronómetro'
      : state.mode === 'pomodoro'
      ? state.phase === 'focus'
        ? `Foco · bloque ${state.cyclesDone + 1}`
        : state.phase === 'long_break'
        ? 'Descanso largo'
        : 'Descanso'
      : 'Temporizador';

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
    state.phase,
    pomodoro,
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

  // ── Reconciliación de las dos listas ────────────────────────
  //
  // El historial y las estadísticas se mantienen por separado (50 filas
  // completas frente a un año de filas mínimas), así que toda escritura tiene
  // que aplicarse a ambas. Se ordena por fecha porque una sesión registrada a
  // mano puede ser de la semana pasada y no debe colarse arriba del todo.

  function applySavedSession(saved: StudySession) {
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
  }

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

  // ── Ciclo del reloj ─────────────────────────────────────────

  async function handleComplete() {
    const s = stateRef.current;
    if (s.mode === 'pomodoro') {
      await handlePomodoroPhaseEnd();
      return;
    }

    playBell();
    sendBrowserNotification('¡Sesión completada! Tiempo de descansar.');
    const saved = await saveSession(true);
    setState({
      ...defaultState,
      mode: s.mode,
      durationMinutes: s.durationMinutes,
      categoryId: s.categoryId,
      taskId: s.taskId,
    });
    toast.success('¡Sesión completada!');
    if (saved) setPendingRating(saved);
  }

  /**
   * Fin de una fase del Pomodoro.
   *
   * Cada bloque de foco se guarda como su propia sesión: es tiempo realmente
   * estudiado y tiene que contar aunque la tanda se abandone a la mitad. Los
   * descansos no se guardan —no son estudio— y por eso tampoco preguntan qué
   * tal fueron. La siguiente fase arranca sola, que es lo que distingue al
   * Pomodoro de encadenar temporizadores a mano.
   */
  async function handlePomodoroPhaseEnd() {
    const s = stateRef.current;
    playBell();

    if (s.phase !== 'focus') {
      sendBrowserNotification('Fin del descanso. A por el siguiente bloque.');
      setState({
        ...s,
        phase: 'focus',
        isRunning: true,
        isPaused: false,
        startedAt: Date.now(),
        pausedAt: null,
        totalPausedMs: 0,
      });
      toast.info('Fin del descanso');
      return;
    }

    const saved = await saveSession(true);
    const cyclesDone = s.cyclesDone + 1;
    const longBreak = cyclesDone % pomodoroRef.current.cyclesBeforeLongBreak === 0;

    sendBrowserNotification(
      longBreak ? '¡Tanda completada! Te has ganado un descanso largo.' : 'Bloque completado. Descansa un poco.'
    );
    setState({
      ...s,
      phase: longBreak ? 'long_break' : 'break',
      cyclesDone,
      isRunning: true,
      isPaused: false,
      startedAt: Date.now(),
      pausedAt: null,
      totalPausedMs: 0,
    });
    toast.success(longBreak ? '¡Tanda completada!' : `Bloque ${cyclesDone} completado`);
    // Se pregunta durante el descanso, que es justo cuando hay tiempo.
    if (saved) setPendingRating(saved);
  }

  async function saveSession(completed: boolean): Promise<StudySession | null> {
    const s = stateRef.current;
    const isCountdown = s.mode !== 'stopwatch';
    const planned = phaseMinutes(s, pomodoroRef.current);
    // Tiempo realmente estudiado. En el cronómetro no hay duración planeada,
    // así que se usa el tiempo transcurrido directamente.
    const actual = Math.max(
      0,
      isCountdown ? planned * 60 - computeSecondsLeft(s) : computeElapsedSeconds(s)
    );
    // Por Server Action: SessionModel valida el rango de la duración planeada
    // según el modo y que el tiempo transcurrido no sea negativo ni absurdo.
    // Insertando directo nada de eso corría.
    const result = await createSessionAction({
      category_id: s.categoryId,
      task_id: s.taskId,
      // El cronómetro no tiene duración planeada: se guarda null. Antes se
      // escribía Math.round(actual / 60), que rompía el CHECK de la base
      // tanto por arriba (más de 2 h) como por abajo (menos de 30 s → 0), y
      // la sesión se perdía con un toast de error.
      duration_minutes: isCountdown ? planned : null,
      actual_duration_seconds: actual,
      mode: s.mode,
      // El bloque en curso solo suma si llegó al final: detener a la mitad
      // guarda el tiempo estudiado, no un pomodoro completado.
      pomodoro_cycles_completed:
        s.mode === 'pomodoro' ? s.cyclesDone + (completed ? 1 : 0) : 0,
      started_at: new Date(s.startedAt!).toISOString(),
      completed_at: completed ? new Date().toISOString() : null,
    });

    if (!result.ok) {
      toast.error(result.error);
      return null;
    }

    applySavedSession(result.data);
    return result.data;
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
    // Detener durante un descanso no guarda nada: un descanso no es estudio, y
    // registrarlo inflaría el tiempo del día con minutos que nadie estudió.
    const isBreak = s.mode === 'pomodoro' && s.phase !== 'focus';
    if (s.startedAt && !isBreak) await saveSession(false);
    setState({
      ...defaultState,
      mode: s.mode,
      durationMinutes: s.durationMinutes,
      categoryId: s.categoryId,
      taskId: s.taskId,
    });
    toast.info('Sesión detenida');
  }

  function handleModeChange(mode: StudyMode) {
    if (state.isRunning) return;
    // Cambiar de modo reinicia la tanda: los bloques completados pertenecen al
    // ciclo que se abandona.
    setState((prev) => ({ ...prev, mode, phase: 'focus', cyclesDone: 0 }));
  }

  const isStopwatch = state.mode === 'stopwatch';
  const isPomodoro = state.mode === 'pomodoro';
  const isRest = isPomodoro && state.phase !== 'focus';
  const totalDuration = phaseMinutes(state, pomodoro) * 60;
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
                  largos. Las fases se encadenan solas.
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
              {tab === 'history' ? 'Historial' : tab === 'stats' ? 'Estadísticas' : 'Metas'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'history' ? (
            <SessionHistory
              sessions={sessions}
              onCreate={() => setEditing(null)}
              onEdit={(session) => setEditing(session)}
            />
          ) : activeTab === 'stats' ? (
            <StudyStats sessions={statsSessions} />
          ) : (
            <StudyGoals
              sessions={statsSessions}
              dailyGoal={dailyGoal}
              weeklyGoal={weeklyGoal}
              pomodoro={pomodoro}
              onPomodoroChange={setPomodoro}
            />
          )}
        </div>
      </div>

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
