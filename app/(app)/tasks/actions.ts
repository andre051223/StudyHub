'use server';

import { revalidatePath } from 'next/cache';
import { TaskModel } from '@/lib/models';
import {
  createTaskSchema,
  updateTaskSchema,
  createSubtaskSchema,
  reorderTasksSchema,
  uuid,
} from '@/lib/api/schemas';
import {
  requireUser,
  parseInput,
  actionOk,
  actionErr,
  actionError,
  type ActionResult,
} from '@/lib/api/actions';
import type { Task, Subtask } from '@/lib/types';

/**
 * Mutaciones de tareas con reglas de negocio.
 *
 * Antes el cliente insertaba y actualizaba directamente contra Supabase, así
 * que `TaskModel` —que recorta el título, calcula la `position` inicial y
 * comprueba la pertenencia antes de escribir— no llegaba a ejecutarse nunca.
 *
 * Las operaciones puramente optimistas y de una sola fila (marcar completada)
 * siguen yendo directas desde el cliente: son cambios de estado sin reglas.
 * Reordenar, en cambio, escribe todo un cuadrante y sí pasa por aquí
 * (`reorderTasksAction`). Ver §5 de markdown/Context.md.
 */

export async function createTaskAction(
  input: unknown
): Promise<ActionResult<Task>> {
  const parsed = parseInput(createTaskSchema, input);
  if (!parsed.ok) return parsed.result;

  try {
    const { supabase, userId } = await requireUser();
    const task = await new TaskModel(supabase).create(parsed.data, userId);
    revalidatePath('/tasks');
    return actionOk(task);
  } catch (e) {
    return actionError(e, 'No se pudo crear la tarea.');
  }
}

export async function updateTaskAction(
  id: string,
  input: unknown
): Promise<ActionResult<Task>> {
  if (!uuid.safeParse(id).success) return actionErr('Identificador inválido.');

  const parsed = parseInput(updateTaskSchema, input);
  if (!parsed.ok) return parsed.result;

  try {
    const { supabase, userId } = await requireUser();
    const task = await new TaskModel(supabase).update(id, parsed.data, userId);
    revalidatePath('/tasks');
    return actionOk(task);
  } catch (e) {
    return actionError(e, 'No se pudo actualizar la tarea.');
  }
}

export async function deleteTaskAction(id: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(id).success) return actionErr('Identificador inválido.');

  try {
    const { supabase, userId } = await requireUser();
    await new TaskModel(supabase).delete(id, userId);
    revalidatePath('/tasks');
    return actionOk(null);
  } catch (e) {
    return actionError(e, 'No se pudo eliminar la tarea.');
  }
}

export async function addSubtaskAction(
  taskId: string,
  input: unknown
): Promise<ActionResult<Subtask>> {
  if (!uuid.safeParse(taskId).success) return actionErr('Identificador inválido.');

  const parsed = parseInput(createSubtaskSchema, input);
  if (!parsed.ok) return parsed.result;

  try {
    const { supabase, userId } = await requireUser();
    // addSubtask comprueba que la tarea sea del usuario y calcula la posición.
    const subtask = await new TaskModel(supabase).addSubtask(
      taskId,
      parsed.data.title,
      userId
    );
    revalidatePath('/tasks');
    return actionOk(subtask);
  } catch (e) {
    return actionError(e, 'No se pudo agregar la subtarea.');
  }
}

/**
 * Reordenar sí pasa por el servidor, a diferencia de mover de cuadrante o
 * marcar completada: escribe varias filas a la vez y tiene una regla —las
 * posiciones de un cuadrante son 0..n-1 sin huecos— que el cliente no debería
 * ser quien la garantice. La interfaz sigue siendo optimista: pinta el nuevo
 * orden y solo revierte si esta acción falla.
 */
export async function reorderTasksAction(
  input: unknown
): Promise<ActionResult<null>> {
  const parsed = parseInput(reorderTasksSchema, input);
  if (!parsed.ok) return parsed.result;

  try {
    const { supabase, userId } = await requireUser();
    await new TaskModel(supabase).reorder(
      parsed.data.quadrant,
      parsed.data.orderedIds,
      userId
    );
    revalidatePath('/tasks');
    return actionOk(null);
  } catch (e) {
    return actionError(e, 'No se pudo guardar el nuevo orden.');
  }
}
