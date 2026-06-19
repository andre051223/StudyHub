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

export type StudyMode = 'simple' | 'pomodoro' | 'stopwatch';

export interface StudySession {
  id: string;
  user_id: string;
  category_id: string | null;
  duration_minutes: number;
  actual_duration_seconds: number;
  mode: StudyMode;
  pomodoro_cycles_completed: number;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  category?: Category;
}

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  mode: StudyMode;
  durationMinutes: number;
  categoryId: string | null;
  startedAt: number | null;
  pausedAt: number | null;
  totalPausedMs: number;
  pomodoroPhase: 'study' | 'short_break' | 'long_break';
  pomodoroCycle: number;
  sessionId: string | null;
}
