export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
  daily_goal_minutes: number;
  weekly_goal_minutes: number;
  /** Ajustes del ciclo Pomodoro (migración 009). */
  pomodoro_focus_minutes: number;
  pomodoro_break_minutes: number;
  pomodoro_long_break_minutes: number;
  pomodoro_cycles_before_long_break: number;
}

/** Los cuatro números que definen un ciclo Pomodoro, ya en camelCase. */
export interface PomodoroSettings {
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
}

export const DEFAULT_POMODORO: PomodoroSettings = {
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
};

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
  note_count?: number;
}

export interface Note {
  id: string;
  user_id: string;
  folder_id: string | null;
  title: string;
  content: Record<string, unknown>;
  content_text: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export type TaskQuadrant =
  | 'urgent_important'
  | 'not_urgent_important'
  | 'urgent_not_important'
  | 'not_urgent_not_important';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  quadrant: TaskQuadrant;
  deadline: string | null;
  category_id: string | null;
  completed: boolean;
  position: number;
  created_at: string;
  completed_at: string | null;
  /**
   * Tiempo que el usuario cree que le llevará la tarea (migración 009). Es
   * opcional: sin estimación, `studied_seconds` es un dato sin veredicto.
   */
  estimated_minutes: number | null;
  subtasks?: Subtask[];
  category?: Category;
  /**
   * Segundos de estudio acumulados sobre esta tarea. No es una columna: se
   * agrega desde study_sessions al cargar la pantalla (ver SessionModel).
   */
  studied_seconds?: number;
}

/**
 * Lo mínimo que necesitan el selector de tareas del temporizador y el
 * formulario de sesión. Vive aquí y no en el componente porque lo comparten
 * tres archivos, y hacer que uno lo importara de otro creaba un ciclo.
 */
export interface OpenTask {
  id: string;
  title: string;
  quadrant: TaskQuadrant;
  category_id: string | null;
  estimated_minutes: number | null;
  /** Segundos ya estudiados sobre la tarea, agregados desde study_sessions. */
  studied_seconds: number;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  position: number;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

/**
 * Cómo se midió la sesión.
 *
 * `manual` (migración 009) es la que no se midió: la escribió el usuario
 * después de estudiar sin la app. Se distingue de `simple` a propósito, para
 * que el historial no presente como cronometrado lo que es recordado.
 */
export type StudyMode = 'simple' | 'stopwatch' | 'pomodoro' | 'manual';

/** Calidad percibida de la sesión, contestada al terminarla (migración 009). */
export type FocusRating = 'focused' | 'ok' | 'distracted';

/** Fase del ciclo Pomodoro. Solo `focus` cuenta como tiempo estudiado. */
export type PomodoroPhase = 'focus' | 'break' | 'long_break';

export interface StudySession {
  id: string;
  user_id: string;
  category_id: string | null;
  /** Tarea sobre la que se estudió, si se eligió una (migración 006). */
  task_id: string | null;
  /**
   * Duración *planeada* de la sesión. Es null en modo cronómetro, que cuenta
   * hacia arriba sin meta. Para saber cuánto se estudió de verdad usa
   * `actual_duration_seconds` (ver lib/stats.ts).
   */
  duration_minutes: number | null;
  actual_duration_seconds: number;
  mode: StudyMode;
  pomodoro_cycles_completed: number;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  /** Cómo fue la sesión, si el usuario la calificó (migración 009). */
  focus_rating: FocusRating | null;
  category?: Category;
  task?: { id: string; title: string } | null;
}

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  mode: StudyMode;
  durationMinutes: number;
  categoryId: string | null;
  /** Tarea sobre la que se estudia. Null = sesión suelta. */
  taskId: string | null;
  startedAt: number | null;
  pausedAt: number | null;
  totalPausedMs: number;
  sessionId: string | null;
  /**
   * Fase en curso del ciclo Pomodoro. Irrelevante en los otros modos, pero se
   * guarda siempre para no tener que estrechar el tipo en cada lectura.
   */
  phase: PomodoroPhase;
  /** Pomodoros de foco completados en la tanda actual. */
  cyclesDone: number;
}
