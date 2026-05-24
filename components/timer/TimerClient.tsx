'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { Play, Pause, Square, RotateCcw, Coffee, PictureInPicture2 } from 'lucide-react';
import { MiniTimer } from './MiniTimer';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { Category, StudySession, StudyMode, TimerState } from '@/lib/types';
import { formatDuration, getCircumference } from '@/lib/utils';
import { SessionHistory } from './SessionHistory';
import { StudyStats } from './StudyStats';
import { StudyGoals } from './StudyGoals';

const STORAGE_KEY = 'studyhub_timer_state';
const POMODORO_STUDY = 25 * 60;
const POMODORO_SHORT = 5 * 60;
const POMODORO_LONG = 15 * 60;

const defaultState: TimerState = {
  isRunning: false,
  isPaused: false,
  mode: 'simple',
  durationMinutes: 25,
  categoryId: null,
  startedAt: null,
  pausedAt: null,
  totalPausedMs: 0,
  pomodoroPhase: 'study',
  pomodoroCycle: 0,
  sessionId: null,
};

interface Props {
  categories: Category[];
  initialSessions: (StudySession & { category?: { name: string; color: string } | null })[];
  dailyGoal: number;
  weeklyGoal: number;
}

export function TimerClient({ categories, initialSessions, dailyGoal, weeklyGoal }: Props) {
  const supabase = createClient();
  const [state, setState] = useState<TimerState>(defaultState);
  const [secondsLeft, setSecondsLeft] = useState(defaultState.durationMinutes * 60);
  const [activeTab, setActiveTab] = useState<'history' | 'stats' | 'goals'>('history');
  const [sessions, setSessions] = useState(initialSessions);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const savingRef = useRef(false);
  const stateRef = useRef(state);
  const pipRootRef = useRef<ReturnType<typeof ReactDOM.createRoot> | null>(null);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  // Keep stateRef in sync so async callbacks always see latest state
  useEffect(() => { stateRef.current = state; });

  // Load persisted state on mount (client only)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setState(JSON.parse(saved));
    } catch {}
  }, []);

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Compute seconds left from timestamps
  const computeSecondsLeft = useCallback((s: TimerState): number => {
    if (!s.isRunning && !s.isPaused) return s.durationMinutes * 60;
    const totalDuration = getPhaseDuration(s) * 1000;
    const now = s.isPaused ? s.pausedAt! : Date.now();
    const elapsed = now - s.startedAt! - s.totalPausedMs;
    return Math.max(0, Math.floor((totalDuration - elapsed) / 1000));
  }, []);

  function getPhaseDuration(s: TimerState): number {
    if (s.mode === 'simple') return s.durationMinutes * 60;
    if (s.pomodoroPhase === 'study') return POMODORO_STUDY;
    if (s.pomodoroPhase === 'long_break') return POMODORO_LONG;
    return POMODORO_SHORT;
  }

  // Tick
  useEffect(() => {
    if (state.isRunning && !state.isPaused) {
      tickRef.current = setInterval(() => {
        const left = computeSecondsLeft(stateRef.current);
        setSecondsLeft(left);
        if (left <= 0 && !savingRef.current) {
          savingRef.current = true;
          handlePhaseComplete().finally(() => { savingRef.current = false; });
        }
      }, 500);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
      setSecondsLeft(computeSecondsLeft(state));
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [state.isRunning, state.isPaused, state.startedAt, state.durationMinutes]);

  async function openPiP() {
    if (!('documentPictureInPicture' in window)) {
      toast.error('Tu navegador no soporta la ventana flotante. Usa Chrome o Edge 116+.');
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pip: Window = await (window as any).documentPictureInPicture.requestWindow({
        width: 260,
        height: 170,
        disallowReturnToOpener: false,
      });
      pip.addEventListener('pagehide', () => setPipWindow(null));
      setPipWindow(pip);
    } catch {
      toast.error('No se pudo abrir la ventana flotante');
    }
  }

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
        onPause={handlePause}
        onResume={handleResume}
      />
    );
  }, [pipWindow, secondsLeft, state.isRunning, state.isPaused, state.pomodoroPhase]);

  // Clean up PiP root when window closes
  useEffect(() => {
    if (!pipWindow) {
      pipRootRef.current = null;
    }
  }, [pipWindow]);

  function playBell() {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/bell.mp3');
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

  async function handlePhaseComplete() {
    const s = stateRef.current;
    playBell();
    if (s.mode === 'simple') {
      sendBrowserNotification('¡Sesión completada! Tiempo de descansar.');
      await saveSession(true);
      setState({ ...defaultState, mode: s.mode, durationMinutes: s.durationMinutes, categoryId: s.categoryId });
      toast.success('¡Sesión completada!');
    } else {
      // Pomodoro phase transition
      if (s.pomodoroPhase === 'study') {
        const newCycle = s.pomodoroCycle + 1;
        const isLong = newCycle % 4 === 0;
        const nextPhase = isLong ? 'long_break' : 'short_break';
        sendBrowserNotification(isLong ? '¡Descanso largo! 15 min.' : '¡Descanso corto! 5 min.');
        setState((prev) => ({
          ...prev,
          pomodoroPhase: nextPhase,
          pomodoroCycle: newCycle,
          startedAt: Date.now(),
          totalPausedMs: 0,
        }));
        toast.success(`Ciclo ${newCycle} completado — ${isLong ? 'descanso largo' : 'descanso corto'}`);
      } else {
        sendBrowserNotification('¡Descanso terminado! A estudiar.');
        setState((prev) => ({
          ...prev,
          pomodoroPhase: 'study',
          startedAt: Date.now(),
          totalPausedMs: 0,
        }));
        toast.info('¡Vuelve a estudiar!');
      }
    }
  }

  async function saveSession(completed: boolean) {
    const s = stateRef.current;
    const actual = s.durationMinutes * 60 - computeSecondsLeft(s);
    const { data, error } = await supabase
      .from('study_sessions')
      .insert({
        category_id: s.categoryId,
        duration_minutes: s.durationMinutes,
        actual_duration_seconds: actual,
        mode: s.mode,
        pomodoro_cycles_completed: s.pomodoroCycle,
        started_at: new Date(s.startedAt!).toISOString(),
        completed_at: completed ? new Date().toISOString() : null,
      })
      .select('*, category:categories(name, color)')
      .single();
    if (error) {
      toast.error('Error al guardar la sesión');
      return;
    }
    if (data) {
      setSessions((prev) => [data as typeof sessions[0], ...prev]);
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
      pomodoroPhase: 'study',
      pomodoroCycle: 0,
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
    setState({ ...defaultState, mode: s.mode, durationMinutes: s.durationMinutes, categoryId: s.categoryId });
    toast.info('Sesión detenida');
  }

  const totalDuration = getPhaseDuration(state);
  const displaySeconds = (!state.isRunning && !state.isPaused) ? totalDuration : secondsLeft;
  const progress = totalDuration > 0 ? (totalDuration - displaySeconds) / totalDuration : 0;
  const radius = 88;
  const circumference = getCircumference(radius);
  const strokeDashoffset = circumference * (1 - progress);

  const phaseLabel =
    state.mode === 'pomodoro'
      ? state.pomodoroPhase === 'study'
        ? 'Estudio'
        : state.pomodoroPhase === 'long_break'
        ? 'Descanso largo'
        : 'Descanso corto'
      : 'Sesión de estudio';

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Timer card */}
      <div className="bg-white rounded-2xl p-8 shadow-[var(--shadow-card)] mb-6">
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
                  stroke={
                    state.pomodoroPhase === 'study' || state.mode === 'simple'
                      ? 'var(--color-primary)'
                      : '#f97316'
                  }
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
                {state.mode === 'pomodoro' && state.isRunning && (
                  <span className="text-xs text-[var(--color-gray-mid)] mt-0.5 flex items-center gap-1">
                    <Coffee size={11} /> Ciclo {state.pomodoroCycle + 1}
                  </span>
                )}
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
                    className="flex items-center gap-2 px-4 py-2.5 border border-[var(--color-gray-border)] text-[var(--color-text-soft)] font-medium rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
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
                {(['simple', 'pomodoro'] as StudyMode[]).map((m) => (
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
                    {m === 'simple' ? 'Simple' : 'Pomodoro'}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration (only simple mode) */}
            {state.mode === 'simple' && (
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Duración: <span className="text-[var(--color-primary)]">{state.durationMinutes} min</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={120}
                  step={5}
                  value={state.durationMinutes}
                  disabled={state.isRunning}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, durationMinutes: Number(e.target.value) }))
                  }
                  className="w-full accent-[var(--color-primary)]"
                />
                <div className="flex justify-between text-xs text-[var(--color-gray-mid)] mt-1">
                  <span>10 min</span>
                  <span>120 min</span>
                </div>
              </div>
            )}

            {state.mode === 'pomodoro' && (
              <div className="bg-[var(--color-gray-light)] rounded-xl p-4 text-sm text-[var(--color-text-soft)]">
                <p className="font-medium text-[var(--color-text)] mb-1">Ciclo Pomodoro</p>
                <p>25 min estudio → 5 min descanso</p>
                <p>Cada 4 ciclos: 15 min de descanso largo</p>
              </div>
            )}

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
      <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
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
            <StudyStats sessions={sessions} />
          ) : (
            <StudyGoals sessions={sessions} dailyGoal={dailyGoal} weeklyGoal={weeklyGoal} />
          )}
        </div>
      </div>
    </div>
  );
}
