'use server';

import { revalidatePath } from 'next/cache';
import { SessionModel } from '@/lib/models';
import {
  uuid,
  createSessionSchema,
  updateSessionSchema,
  updateGoalsSchema,
  updatePomodoroSchema,
} from '@/lib/api/schemas';
import {
  requireUser,
  parseInput,
  actionOk,
  actionErr,
  actionError,
  type ActionResult,
} from '@/lib/api/actions';
import type { StudySession, PomodoroSettings } from '@/lib/types';

/**
 * Guardado de sesiones de estudio y metas.
 *
 * Pasa por Server Action porque `SessionModel.create` tiene reglas reales que
 * antes no se ejecutaban: el rango 10–120 solo aplica al temporizador y no al
 * cronómetro, y el tiempo transcurrido no puede ser negativo. El cliente
 * insertaba directo, así que ninguna de las dos se comprobaba.
 */

export async function createSessionAction(
  input: unknown
): Promise<ActionResult<StudySession>> {
  const parsed = parseInput(createSessionSchema, input);
  if (!parsed.ok) return parsed.result;

  try {
    const { supabase, userId } = await requireUser();
    const session = await new SessionModel(supabase).create(parsed.data, userId);
    revalidatePath('/timer');
    revalidatePath('/dashboard');
    return actionOk(session);
  } catch (e) {
    return actionError(e, 'No se pudo guardar la sesión.');
  }
}

/**
 * Corrige una sesión guardada, o solo la califica.
 *
 * Las dos cosas pasan por aquí porque son la misma escritura: responder «¿cómo
 * fue?» al terminar es un update de un solo campo sobre la fila recién creada.
 */
export async function updateSessionAction(
  id: unknown,
  input: unknown
): Promise<ActionResult<StudySession>> {
  if (!uuid.safeParse(id).success) return actionErr('Identificador inválido.');

  const parsed = parseInput(updateSessionSchema, input);
  if (!parsed.ok) return parsed.result;

  try {
    const { supabase, userId } = await requireUser();
    const session = await new SessionModel(supabase).update(
      id as string,
      parsed.data,
      userId
    );
    revalidatePath('/timer');
    revalidatePath('/dashboard');
    // El tiempo acumulado por tarea se calcula sobre estas filas.
    revalidatePath('/tasks');
    return actionOk(session);
  } catch (e) {
    return actionError(e, 'No se pudo actualizar la sesión.');
  }
}

export async function deleteSessionAction(id: unknown): Promise<ActionResult<{ id: string }>> {
  if (!uuid.safeParse(id).success) return actionErr('Identificador inválido.');

  try {
    const { supabase, userId } = await requireUser();
    await new SessionModel(supabase).delete(id as string, userId);
    revalidatePath('/timer');
    revalidatePath('/dashboard');
    revalidatePath('/tasks');
    return actionOk({ id: id as string });
  } catch (e) {
    return actionError(e, 'No se pudo eliminar la sesión.');
  }
}

export async function updateGoalsAction(
  input: unknown
): Promise<ActionResult<{ daily_goal_minutes: number; weekly_goal_minutes: number }>> {
  const parsed = parseInput(updateGoalsSchema, input);
  if (!parsed.ok) return parsed.result;

  try {
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase
      .from('profiles')
      .update(parsed.data)
      .eq('id', userId)
      .select('daily_goal_minutes, weekly_goal_minutes')
      .single();
    if (error) throw new Error('No se pudieron guardar las metas.');

    revalidatePath('/timer');
    return actionOk(data);
  } catch (e) {
    return actionError(e, 'No se pudieron guardar las metas.');
  }
}

/**
 * Ajustes del ciclo Pomodoro (migración 009).
 *
 * Van aparte de `updateGoalsAction` aunque compartan tabla: las metas son un
 * objetivo y esto es una preferencia de ritmo. Mezclarlas obligaría a enviar
 * las cuatro duraciones cada vez que se cambia la meta diaria.
 */
export async function updatePomodoroAction(
  input: unknown
): Promise<ActionResult<PomodoroSettings>> {
  const parsed = parseInput(updatePomodoroSchema, input);
  if (!parsed.ok) return parsed.result;

  try {
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase
      .from('profiles')
      .update(parsed.data)
      .eq('id', userId)
      .select(
        'pomodoro_focus_minutes, pomodoro_break_minutes, pomodoro_long_break_minutes, pomodoro_cycles_before_long_break'
      )
      .single();
    if (error) throw new Error('No se pudo guardar la configuración del Pomodoro.');

    revalidatePath('/timer');
    return actionOk({
      focusMinutes: data.pomodoro_focus_minutes,
      breakMinutes: data.pomodoro_break_minutes,
      longBreakMinutes: data.pomodoro_long_break_minutes,
      cyclesBeforeLongBreak: data.pomodoro_cycles_before_long_break,
    });
  } catch (e) {
    return actionError(e, 'No se pudo guardar la configuración del Pomodoro.');
  }
}
