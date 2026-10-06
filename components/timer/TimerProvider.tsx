'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import ReactDOM from 'react-dom/client';
import { toast } from 'sonner';
import { createSessionAction } from '@/app/(app)/timer/actions';
import type { PomodoroSettings, StudyMode, StudySession, TimerState } from '@/lib/types';
import { formatDuration } from '@/lib/utils';
import { MiniTimer } from './MiniTimer';

// ── Motor del temporizador ──────────────────────────────────────
//
// Vive en el layout de (app) y no en la página /timer para que el reloj siga
// funcionando —campana, notificación, guardado de la sesión y ventana
// flotante— mientras el usuario navega por notas, tareas o la agenda. Antes
// estaba dentro de `TimerClient`: al salir de /timer el componente se
// desmontaba y la sesión no se registraba hasta volver a esa página.
//
// `TimerClient` (la pantalla de /timer) y `TimerIndicator` (el reloj flotante
// del resto de páginas) son solo vistas sobre este contexto.

const STORAGE_KEY = 'studyhub_timer_state';

export const defaultTimerState: TimerState = {
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
export function phaseMinutes(s: TimerState, p: PomodoroSettings): number {
  if (s.mode !== 'pomodoro') return s.durationMinutes;
  if (s.phase === 'focus') return p.focusMinutes;
  return s.phase === 'long_break' ? p.longBreakMinutes : p.breakMinutes;
}

/**
 * Worker mínimo que emite un mensaje cada `ms`. Se crea desde un Blob para no
 * necesitar un archivo aparte ni configuración del bundler. Devuelve null si el
 * navegador no lo permite, y el llamador usa entonces un setInterval normal.
 */
function createTickWorker(ms: number): Worker | null {
  if (typeof Worker === 'undefined') return null;
  try {
    const src = `setInterval(() => postMessage(0), ${ms});`;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    return worker;
  } catch {
    return null;
  }
}

/** Instante (ms epoch) en que termina el tramo en curso de un modo con cuenta atrás. */
function scheduledEnd(s: TimerState, p: PomodoroSettings): number {
  return s.startedAt! + s.totalPausedMs + phaseMinutes(s, p) * 60_000;
}

/** Margen a partir del cual un final se considera "tardío" (pestaña dormida). */
const LATE_THRESHOLD_MS = 60_000;

const timeFormatter = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });

function computeElapsedSeconds(s: TimerState): number {
  if (!s.isRunning && !s.isPaused) return 0;
  const now = s.isPaused ? s.pausedAt! : Date.now();
  return Math.max(0, Math.floor((now - s.startedAt! - s.totalPausedMs) / 1000));
}

function computeSecondsLeft(s: TimerState, p: PomodoroSettings): number {
  const total = phaseMinutes(s, p) * 60;
  if (!s.isRunning && !s.isPaused) return total;
  return Math.max(0, total - computeElapsedSeconds(s));
}

/** Valor que muestra el reloj: restante en cuenta atrás, transcurrido en el cronómetro. */
function displayValue(s: TimerState, p: PomodoroSettings): number {
  return s.mode === 'stopwatch' ? computeElapsedSeconds(s) : computeSecondsLeft(s, p);
}

type SavedListener = (session: StudySession) => void;

interface TimerContextValue {
  state: TimerState;
  /** Para los ajustes previos al arranque: modo, duración, tarea, categoría. */
  setState: Dispatch<SetStateAction<TimerState>>;
  /** Restante en cuenta atrás; transcurrido en el cronómetro. */
  secondsLeft: number;
  /** Duración total del tramo en curso, en segundos. */
  totalDuration: number;
  phaseLabel: string;
  /** Pomodoro detenido entre un bloque y su descanso, esperando decisión. */
  awaitingBreak: boolean;
  /** Pomodoro detenido tras un descanso, esperando a que empiece el siguiente bloque. */
  awaitingFocus: boolean;
  startLabel: string;
  pomodoro: PomodoroSettings;
  setPomodoro: (p: PomodoroSettings) => void;
  /** Sesión recién completada, a la espera de que el usuario diga cómo le fue. */
  pendingRating: StudySession | null;
  setPendingRating: Dispatch<SetStateAction<StudySession | null>>;
  pipOpen: boolean;
  openPiP: () => Promise<void>;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<void>;
  skipBreak: () => Promise<void>;
  changeMode: (mode: StudyMode) => void;
  /** Suscripción a las sesiones que guarda el reloj (para refrescar listas). */
  onSessionSaved: (listener: SavedListener) => () => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer debe usarse dentro de <TimerProvider>');
  return ctx;
}

interface Props {
  initialPomodoro: PomodoroSettings;
  children: React.ReactNode;
}

export function TimerProvider({ initialPomodoro, children }: Props) {
  const [state, setState] = useState<TimerState>(defaultTimerState);
  const [secondsLeft, setSecondsLeft] = useState(defaultTimerState.durationMinutes * 60);
  const [pomodoro, setPomodoro] = useState(initialPomodoro);
  const [pendingRating, setPendingRating] = useState<StudySession | null>(null);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const savingRef = useRef(false);
  const pipRootRef = useRef<ReturnType<typeof ReactDOM.createRoot> | null>(null);
  const listenersRef = useRef(new Set<SavedListener>());

  // Los callbacks asíncronos (latido, guardado, ventana flotante) tienen que
  // ver siempre el último estado y los últimos ajustes del Pomodoro, que la
  // pestaña de metas puede cambiar con el reloj en marcha.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });
  const pomodoroRef = useRef(pomodoro);
  useEffect(() => { pomodoroRef.current = pomodoro; });

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
        parsed.taskId = parsed.taskId ?? null;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación desde localStorage
        setState(parsed);
      }
    } catch {}
  }, []);

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // `handleComplete` se recrea en cada render, pero el latido no debe
  // reiniciarse por eso: se invoca a través de un ref.
  const handleCompleteRef = useRef(handleComplete);
  useEffect(() => { handleCompleteRef.current = handleComplete; });

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
    if (state.isRunning && !state.isPaused) {
      const onTick = () => {
        const s = stateRef.current;
        if (!s.isRunning || s.isPaused) return;
        const value = displayValue(s, pomodoroRef.current);
        setSecondsLeft(value);
        // The stopwatch counts up with no target, so it never auto-completes.
        if (s.mode !== 'stopwatch' && value <= 0 && !savingRef.current) {
          savingRef.current = true;
          handleCompleteRef.current().finally(() => { savingRef.current = false; });
        }
      };

      // El latido sale de un Worker y no de un setInterval de la página: con
      // la pestaña oculta más de 5 min, Chrome/Edge agrupan los temporizadores
      // de la página a un disparo por minuto (o los congelan del todo), y la
      // sesión se daba por terminada solo al volver. Los Workers dedicados no
      // sufren ese recorte. Si el navegador no permite crearlo, se cae al
      // intervalo de siempre.
      const worker = createTickWorker(500);
      if (worker) {
        worker.onmessage = onTick;
      } else {
        tickRef.current = setInterval(onTick, 500);
      }

      // Al volver a la pestaña (o al salir de una suspensión) se recalcula al
      // instante en lugar de esperar al siguiente latido.
      const onVisible = () => { if (document.visibilityState === 'visible') onTick(); };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('pageshow', onVisible);
      window.addEventListener('focus', onVisible);

      return () => {
        worker?.terminate();
        if (tickRef.current) clearInterval(tickRef.current);
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('pageshow', onVisible);
        window.removeEventListener('focus', onVisible);
      };
    }

    if (tickRef.current) clearInterval(tickRef.current);
    // stateRef ya está sincronizado: su effect se declara antes que este.
    setSecondsLeft(displayValue(stateRef.current, pomodoroRef.current));
  }, [
    state.isRunning,
    state.isPaused,
    state.startedAt,
    state.durationMinutes,
    state.mode,
    state.phase,
    pomodoro,
  ]);

  // Mientras el reloj corre se retiene un Web Lock. Chromium (Chrome y Edge)
  // no congela ni descarta una pestaña que tiene un lock tomado; sin él, las
  // "pestañas en suspensión" de Edge dormían la página a mitad de sesión, la
  // ventana flotante se cerraba con ella y nada se registraba hasta volver.
  useEffect(() => {
    if (!state.isRunning || !('locks' in navigator)) return;
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => { release = resolve; });
    navigator.locks
      .request(`studyhub-timer-${Math.random().toString(36).slice(2)}`, () => held)
      .catch(() => {});
    return () => release();
  }, [state.isRunning]);

  // ── Ventana flotante ────────────────────────────────────────

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

      // Icono y título propios. El documento de la ventana flotante nace en
      // blanco (about:blank), así que sin esto el navegador le pone su propio
      // icono y no se distingue de cualquier otra ventana. La URL va absoluta
      // porque about:blank no resuelve rutas relativas contra el sitio.
      const icon = pip.document.createElement('link');
      icon.rel = 'icon';
      icon.type = 'image/png';
      icon.href = new URL('/icons/timer', window.location.origin).href;
      pip.document.head.appendChild(icon);
      pip.document.title = 'StudyHub · Temporizador';

      pip.addEventListener('pagehide', () => setPipWindow(null));
      setPipWindow(pip);
    } catch {
      toast.error('No se pudo abrir la ventana flotante');
    }
  }

  // Los controles se recrean en cada render. Envolverlos en callbacks estables
  // evita que la ventana flotante se vuelva a renderizar solo porque cambió la
  // identidad de una función, y da a los consumidores del contexto funciones
  // que no cambian.
  const handlersRef = useRef({ handleStart, handlePause, handleResume, handleStop, handleSkipBreak });
  useEffect(() => {
    handlersRef.current = { handleStart, handlePause, handleResume, handleStop, handleSkipBreak };
  });
  const stable = useRef({
    start: () => handlersRef.current.handleStart(),
    pause: () => handlersRef.current.handlePause(),
    resume: () => handlersRef.current.handleResume(),
    stop: () => handlersRef.current.handleStop(),
    skipBreak: () => handlersRef.current.handleSkipBreak(),
  }).current;

  const awaitingBreak =
    state.mode === 'pomodoro' && state.phase !== 'focus' && !state.isRunning;
  const awaitingFocus =
    state.mode === 'pomodoro' && state.phase === 'focus' && !state.isRunning && state.cyclesDone > 0;
  const startLabel =
    state.mode !== 'pomodoro'
      ? 'Iniciar'
      : awaitingBreak
      ? 'Iniciar descanso'
      : awaitingFocus
      ? `Iniciar bloque ${state.cyclesDone + 1}`
      : 'Iniciar';

  // Sync mini timer into PiP window
  useEffect(() => {
    if (!pipWindow) return;
    if (!pipRootRef.current) {
      pipRootRef.current = ReactDOM.createRoot(pipWindow.document.body);
    }
    pipWindow.document.title = `${formatDuration(secondsLeft)} · ${phaseLabel} · StudyHub`;
    pipRootRef.current.render(
      <MiniTimer
        secondsLeft={secondsLeft}
        phaseLabel={phaseLabel}
        isRunning={state.isRunning}
        isPaused={state.isPaused}
        onPause={stable.pause}
        onResume={stable.resume}
        onStop={stable.stop}
        onStart={stable.start}
        startLabel={awaitingBreak ? 'Descansar' : 'Iniciar'}
        onSkip={awaitingBreak ? stable.skipBreak : undefined}
        skipLabel="Saltar"
      />
    );
  }, [pipWindow, secondsLeft, state.isRunning, state.isPaused, phaseLabel, awaitingBreak, stable]);

  // Clean up PiP root when window closes
  useEffect(() => {
    if (!pipWindow) {
      pipRootRef.current = null;
    }
  }, [pipWindow]);

  // El proveedor solo se desmonta al salir del área autenticada (cerrar
  // sesión): la ventana flotante se cierra para no dejar un reloj huérfano.
  const pipWindowRef = useRef<Window | null>(null);
  useEffect(() => { pipWindowRef.current = pipWindow; }, [pipWindow]);
  useEffect(() => () => pipWindowRef.current?.close(), []);

  // ── Avisos ──────────────────────────────────────────────────

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
      new Notification('StudyHub', { body: message, icon: '/icons/timer' });
    }
  }

  async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  // ── Ciclo del reloj ─────────────────────────────────────────

  /**
   * Instante real en que terminó el tramo y si se detectó tarde.
   *
   * Si el navegador durmió la pestaña, el final se detecta al despertar, a
   * veces horas después. La sesión se registra igualmente con la hora en que
   * terminó de verdad, no con la de la detección, para que el historial, la
   * racha y la gráfica del día no se desplacen.
   */
  function resolveEnd(s: TimerState): { endAt: number; late: boolean } {
    const endAt = Math.min(Date.now(), scheduledEnd(s, pomodoroRef.current));
    return { endAt, late: Date.now() - endAt > LATE_THRESHOLD_MS };
  }

  /** Aviso de fin: con campana si es puntual; si llega tarde, solo el toast con la hora real. */
  function announceEnd(late: boolean, endAt: number, message: string) {
    if (late) {
      toast.info(`${message} (terminó a las ${timeFormatter.format(endAt)})`);
      return;
    }
    playBell();
    sendBrowserNotification(message);
  }

  async function handleComplete() {
    const s = stateRef.current;
    if (s.mode === 'pomodoro') {
      await handlePomodoroPhaseEnd();
      return;
    }

    const { endAt, late } = resolveEnd(s);
    announceEnd(late, endAt, '¡Sesión completada! Tiempo de descansar.');
    const saved = await saveSession(true, endAt);
    setState({
      ...defaultTimerState,
      mode: s.mode,
      durationMinutes: s.durationMinutes,
      categoryId: s.categoryId,
      taskId: s.taskId,
    });
    if (!late) toast.success('¡Sesión completada!');
    if (saved) setPendingRating(saved);
  }

  /**
   * Fin de una fase del Pomodoro.
   *
   * Cada bloque de foco se guarda como su propia sesión: es tiempo realmente
   * estudiado y tiene que contar aunque la tanda se abandone a la mitad. Los
   * descansos no se guardan —no son estudio— y por eso tampoco preguntan qué
   * tal fueron.
   *
   * Las fases no se encadenan solas: al terminar un bloque el reloj se detiene
   * en el descanso que toca y el usuario elige si iniciarlo o saltarlo
   * (`handleSkipBreak`); al terminar el descanso espera a que inicie el
   * siguiente bloque. Encadenarlas arrancaba descansos y bloques que nadie
   * estaba mirando.
   */
  async function handlePomodoroPhaseEnd() {
    const s = stateRef.current;
    const { endAt, late } = resolveEnd(s);
    const idle = {
      isRunning: false,
      isPaused: false,
      startedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
    };

    if (s.phase !== 'focus') {
      announceEnd(late, endAt, `Fin del descanso. Inicia el bloque ${s.cyclesDone + 1} cuando quieras.`);
      setState({ ...s, ...idle, phase: 'focus' });
      if (!late) toast.info('Fin del descanso');
      return;
    }

    const saved = await saveSession(true, endAt);
    const cyclesDone = s.cyclesDone + 1;
    const longBreak = cyclesDone % pomodoroRef.current.cyclesBeforeLongBreak === 0;

    announceEnd(
      late,
      endAt,
      longBreak
        ? '¡Tanda completada! Puedes iniciar el descanso largo o seguir con otro bloque.'
        : `Bloque ${cyclesDone} completado. Inicia el descanso o pasa al siguiente bloque.`
    );
    setState({ ...s, ...idle, phase: longBreak ? 'long_break' : 'break', cyclesDone });
    if (!late) toast.success(longBreak ? '¡Tanda completada!' : `Bloque ${cyclesDone} completado`);
    if (saved) setPendingRating(saved);
  }

  async function saveSession(
    completed: boolean,
    endAt: number = Date.now()
  ): Promise<StudySession | null> {
    const s = stateRef.current;
    const isCountdown = s.mode !== 'stopwatch';
    const planned = phaseMinutes(s, pomodoroRef.current);
    // Tiempo realmente estudiado. En el cronómetro no hay duración planeada,
    // así que se usa el tiempo transcurrido directamente.
    const actual = Math.max(
      0,
      isCountdown
        ? planned * 60 - computeSecondsLeft(s, pomodoroRef.current)
        : computeElapsedSeconds(s)
    );
    // Por Server Action: SessionModel valida el rango de la duración planeada
    // según el modo y que el tiempo transcurrido no sea negativo ni absurdo.
    const result = await createSessionAction({
      category_id: s.categoryId,
      task_id: s.taskId,
      // El cronómetro no tiene duración planeada: se guarda null.
      duration_minutes: isCountdown ? planned : null,
      actual_duration_seconds: actual,
      mode: s.mode,
      // El bloque en curso solo suma si llegó al final: detener a la mitad
      // guarda el tiempo estudiado, no un pomodoro completado.
      pomodoro_cycles_completed:
        s.mode === 'pomodoro' ? s.cyclesDone + (completed ? 1 : 0) : 0,
      started_at: new Date(s.startedAt!).toISOString(),
      completed_at: completed ? new Date(endAt).toISOString() : null,
    });

    if (!result.ok) {
      toast.error(result.error);
      return null;
    }

    listenersRef.current.forEach((listener) => listener(result.data));
    return result.data;
  }

  async function handleStart() {
    await requestNotificationPermission();
    setState((prev) => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      startedAt: Date.now(),
      pausedAt: null,
      totalPausedMs: 0,
    }));
  }

  /** Pasa directamente del final de un bloque al siguiente, sin descanso. */
  async function handleSkipBreak() {
    await requestNotificationPermission();
    setState((prev) => ({
      ...prev,
      phase: 'focus',
      isRunning: true,
      isPaused: false,
      startedAt: Date.now(),
      pausedAt: null,
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
      ...defaultTimerState,
      mode: s.mode,
      durationMinutes: s.durationMinutes,
      categoryId: s.categoryId,
      taskId: s.taskId,
    });
    toast.info(s.startedAt ? 'Sesión detenida' : 'Tanda reiniciada');
  }

  const changeMode = useCallback((mode: StudyMode) => {
    if (stateRef.current.isRunning) return;
    // Cambiar de modo reinicia la tanda: los bloques completados pertenecen al
    // ciclo que se abandona.
    setState((prev) => ({ ...prev, mode, phase: 'focus', cyclesDone: 0 }));
  }, []);

  const onSessionSaved = useCallback((listener: SavedListener) => {
    const listeners = listenersRef.current;
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const value: TimerContextValue = {
    state,
    setState,
    secondsLeft,
    totalDuration: phaseMinutes(state, pomodoro) * 60,
    phaseLabel,
    awaitingBreak,
    awaitingFocus,
    startLabel,
    pomodoro,
    setPomodoro,
    pendingRating,
    setPendingRating,
    pipOpen: pipWindow !== null,
    openPiP,
    ...stable,
    changeMode,
    onSessionSaved,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}
