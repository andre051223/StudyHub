import { SupabaseClient } from '@supabase/supabase-js';
import type { StudySession, StudyMode, FocusRating } from '@/lib/types';
import { summarize, type StatsSession } from '@/lib/stats';
import { BaseModel } from './BaseModel';

/** Límites del selector de duración del temporizador (modo `simple`). */
export const MIN_TIMER_MINUTES = 10;
export const MAX_TIMER_MINUTES = 120;

/** Límites del bloque de foco del Pomodoro (migración 009). */
export const MIN_POMODORO_FOCUS_MINUTES = 5;
export const MAX_POMODORO_FOCUS_MINUTES = 90;

/**
 * Tope de tiempo realmente estudiado en una sola sesión.
 *
 * Existe sobre todo por el registro manual: escribir «600» en el campo de
 * minutos es un error de tecleo plausible, y una sesión de diez horas
 * desplaza la media diaria del mes entero. El cronómetro tampoco tiene
 * ninguna razón legítima para pasar de un día.
 */
export const MAX_SESSION_SECONDS = 24 * 60 * 60;

/**
 * Rango válido de la duración *planeada* según el modo, o null si ese modo no
 * planea nada.
 *
 * `stopwatch` cuenta hacia arriba sin meta y `manual` se escribe después de
 * estudiar: en ninguno de los dos existe un plan que validar, así que su
 * `duration_minutes` debe ser null. Antes esta regla estaba escrita como un
 * `if (mode !== 'stopwatch')`, que al reintroducir el Pomodoro habría exigido
 * a un bloque de foco de 5 min cumplir el mínimo de 10 del temporizador.
 */
const PLANNED_RANGE: Record<StudyMode, { min: number; max: number } | null> = {
  simple: { min: MIN_TIMER_MINUTES, max: MAX_TIMER_MINUTES },
  pomodoro: { min: MIN_POMODORO_FOCUS_MINUTES, max: MAX_POMODORO_FOCUS_MINUTES },
  stopwatch: null,
  manual: null,
};

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
  focus_rating?: FocusRating | null;
}

/**
 * Campos editables de una sesión ya guardada.
 *
 * `mode` no está: es un hecho sobre cómo se midió el tiempo. Si se pudiera
 * reescribir, el historial perdería la única marca que separa lo cronometrado
 * de lo registrado a mano.
 */
export interface UpdateSessionInput {
  category_id?: string | null;
  task_id?: string | null;
  duration_minutes?: number | null;
  actual_duration_seconds?: number;
  started_at?: string;
  completed_at?: string | null;
  notes?: string | null;
  focus_rating?: FocusRating | null;
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

  /** Reglas comunes a crear y a editar; ver `PLANNED_RANGE`. */
  private validatePlanned(mode: StudyMode, plannedMinutes: number | null | undefined): void {
    const range = PLANNED_RANGE[mode];
    const planned = plannedMinutes ?? null;

    if (!range) {
      if (planned !== null) {
        throw new Error('Este modo no tiene una duración planeada.');
      }
      return;
    }

    if (planned === null || planned < range.min || planned > range.max) {
      throw new Error(`La duración debe estar entre ${range.min} y ${range.max} minutos.`);
    }
  }

  private validateElapsed(seconds: number): void {
    if (seconds < 0) {
      throw new Error('El tiempo transcurrido no puede ser negativo.');
    }
    if (seconds > MAX_SESSION_SECONDS) {
      throw new Error('Una sesión no puede durar más de 24 horas.');
    }
  }

  async create(input: CreateSessionInput, userId: string): Promise<StudySession> {
    this.validatePlanned(input.mode, input.duration_minutes);
    this.validateElapsed(input.actual_duration_seconds);

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
        focus_rating: input.focus_rating ?? null,
      })
      .select('*, category:categories(name, color), task:tasks(id, title)')
      .single();
    if (error) this.handleError(error);
    return data;
  }

  /**
   * Corrige una sesión ya guardada.
   *
   * Sin esto, olvidarse de detener el cronómetro dejaba una sesión inflada que
   * falseaba para siempre la racha, el promedio y el desglose por categoría,
   * sin ninguna forma de arreglarlo desde la app.
   *
   * Se relee la fila antes de escribir porque las reglas de duración dependen
   * del modo, y el modo no viaja en la entrada: es la propia sesión la que
   * dice contra qué rango hay que validar la duración planeada.
   */
  async update(
    id: string,
    input: UpdateSessionInput,
    userId: string
  ): Promise<StudySession> {
    const current = await this.findById(id, userId);
    if (!current) throw new Error('Sesión no encontrada.');

    if (input.duration_minutes !== undefined) {
      this.validatePlanned(current.mode, input.duration_minutes);
    }
    if (input.actual_duration_seconds !== undefined) {
      this.validateElapsed(input.actual_duration_seconds);
    }

    // Solo las claves presentes: un `undefined` en el objeto de update de
    // PostgREST se serializa como null y borraría el valor existente.
    const updates: Record<string, unknown> = {};
    for (const key of [
      'category_id',
      'task_id',
      'duration_minutes',
      'actual_duration_seconds',
      'started_at',
      'completed_at',
      'notes',
      'focus_rating',
    ] as const) {
      if (input[key] !== undefined) updates[key] = input[key];
    }
    if (Object.keys(updates).length === 0) return current;

    const { data, error } = await this.supabase
      .from('study_sessions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*, category:categories(name, color), task:tasks(id, title)')
      .single();
    if (error) this.handleError(error);
    return data;
  }

  async delete(id: string, userId: string): Promise<void> {
    const current = await this.findById(id, userId);
    if (!current) throw new Error('Sesión no encontrada.');

    const { error } = await this.supabase
      .from('study_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) this.handleError(error);
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
      .select(
        'id, started_at, actual_duration_seconds, completed_at, category_id, focus_rating, category:categories(name, color)'
      )
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
