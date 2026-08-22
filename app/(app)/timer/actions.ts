'use server';

import { revalidatePath } from 'next/cache';
import { SessionModel } from '@/lib/models';
import { createSessionSchema, updateGoalsSchema } from '@/lib/api/schemas';
import {
  requireUser,
  parseInput,
  actionOk,
  actionError,
  type ActionResult,
} from '@/lib/api/actions';
import type { StudySession } from '@/lib/types';

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
