import { SupabaseClient } from '@supabase/supabase-js';
import type { StudySession, StudyMode } from '@/lib/types';
import { summarize, type StatsSession } from '@/lib/stats';
import { BaseModel } from './BaseModel';

/** Límites del selector de duración del temporizador (modo `simple`). */
export const MIN_TIMER_MINUTES = 10;
export const MAX_TIMER_MINUTES = 120;

export interface CreateSessionInput {
  category_id?: string | null;
  /** Tarea sobre la que se estudió. Null = sesión suelta (migración 006). */
  task_id?: string | null;
  /** Null en modo cronómetro: no hay duración planeada. */
  duration_minutes: number | null;
  actual_duration_seconds: number;
  mode: StudyMode;
  pomodoro_cycles_completed?: number;
  started_at: string;
  completed_at?: string | null;
  notes?: string | null;
}

export interface SessionStats {
  totalMinutesThisWeek: number;
  currentStreak: number;
  topCategoryThisMonth: string | null;
  dailyAverage: number;
}

export class SessionModel extends BaseModel {
  constructor(supabase: SupabaseClient) {
    super(supabase);
  }

  async findAllByUser(userId: string, limit = 50): Promise<StudySession[]> {
    const { data, error } = await this.supabase
      .from('study_sessions')
      .select('*, category:categories(name, color), task:tasks(id, title)')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) this.handleError(error);
    return data ?? [];
  }

  async findById(id: string, userId: string): Promise<StudySession | null> {
    const { data, error } = await this.supabase
      .from('study_sessions')
      .select('*, category:categories(name, color)')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) this.handleError(error);
    return data ?? null;
  }

  async create(input: CreateSessionInput, userId: string): Promise<StudySession> {
    // El cronómetro no tiene duración planeada, así que el rango del selector
    // del temporizador no le aplica. Validarlo con la misma regla hacía
    // imposible guardar una sesión de cronómetro larga o muy corta.
    if (input.mode !== 'stopwatch') {
      const planned = input.duration_minutes;
      if (
        planned === null ||
        planned < MIN_TIMER_MINUTES ||
        planned > MAX_TIMER_MINUTES
      ) {
        throw new Error(
          `La duración debe estar entre ${MIN_TIMER_MINUTES} y ${MAX_TIMER_MINUTES} minutos.`
        );
      }
    }

    if (input.actual_duration_seconds < 0) {
      throw new Error('El tiempo transcurrido no puede ser negativo.');
    }

    const { data, error } = await this.supabase
      .from('study_sessions')
      .insert({
        user_id: userId,
        category_id: input.category_id ?? null,
        task_id: input.task_id ?? null,
        duration_minutes: input.duration_minutes,
        actual_duration_seconds: input.actual_duration_seconds,
        mode: input.mode,
        pomodoro_cycles_completed: input.pomodoro_cycles_completed ?? 0,
        started_at: input.started_at,
        completed_at: input.completed_at ?? null,
        notes: input.notes ?? null,
      })
      .select('*, category:categories(name, color), task:tasks(id, title)')
      .single();
    if (error) this.handleError(error);
    return data;
  }

  /**
   * Sesiones completadas de los últimos `days` días, con las columnas mínimas
   * que necesitan los cálculos de `lib/stats.ts`.
   *
   * Es la consulta que alimenta todas las estadísticas. La ventana está
   * acotada para que el payload no crezca sin límite, pero es lo bastante
   * amplia como para que la racha y el promedio no se corten: antes las
   * pantallas derivaban estos números de las últimas 50 sesiones, así que a
   * los dos meses de uso la racha se rompía en el borde de esa ventana.
   */
  async findForStats(userId: string, days = 365): Promise<StatsSession[]> {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const { data, error } = await this.supabase
      .from('study_sessions')
      .select('started_at, actual_duration_seconds, completed_at, category_id, category:categories(name, color)')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .gte('started_at', from.toISOString())
      .order('started_at', { ascending: false });
    if (error) this.handleError(error);
    return (data ?? []) as StatsSession[];
  }

  async getStats(userId: string): Promise<SessionStats> {
    const summary = summarize(await this.findForStats(userId));

    return {
      totalMinutesThisWeek: summary.minutesThisWeek,
      currentStreak: summary.currentStreak,
      topCategoryThisMonth: summary.topCategoryThisMonth,
      dailyAverage: summary.dailyAverage,
    };
  }

  /**
   * Segundos estudiados por tarea, para el usuario dado.
   *
   * PostgREST no expone `GROUP BY`, así que la agregación se hace aquí sobre
   * las columnas mínimas. Solo se traen las sesiones completadas y con tarea
   * —el índice parcial `sessions_task_idx` cubre exactamente ese filtro—, que
   * son una fracción del historial: una sesión suelta no dice nada sobre
   * ninguna tarea.
   */
  async studiedSecondsByTask(userId: string): Promise<Map<string, number>> {
    const { data, error } = await this.supabase
      .from('study_sessions')
      .select('task_id, actual_duration_seconds')
      .eq('user_id', userId)
      .not('task_id', 'is', null)
      .not('completed_at', 'is', null);
    if (error) this.handleError(error);

    const totals = new Map<string, number>();
    for (const row of (data ?? []) as { task_id: string; actual_duration_seconds: number }[]) {
      totals.set(row.task_id, (totals.get(row.task_id) ?? 0) + (row.actual_duration_seconds ?? 0));
    }
    return totals;
  }
}
