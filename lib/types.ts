export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
  daily_goal_minutes: number;
  weekly_goal_minutes: number;
}

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
  subtasks?: Subtask[];
  category?: Category;
  /**
   * Segundos de estudio acumulados sobre esta tarea. No es una columna: se
   * agrega desde study_sessions al cargar la pantalla (ver SessionModel).
   */
  studied_seconds?: number;
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

// 'pomodoro' ya no es seleccionable en la UI; se conserva para poder
// mostrar sesiones antiguas guardadas con ese modo.
export type StudyMode = 'simple' | 'stopwatch' | 'pomodoro';

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
}
