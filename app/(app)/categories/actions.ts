'use server';

import { revalidatePath } from 'next/cache';
import { CategoryModel } from '@/lib/models';
import { createCategorySchema, uuid } from '@/lib/api/schemas';
import {
  requireUser,
  parseInput,
  actionOk,
  actionErr,
  actionError,
  type ActionResult,
} from '@/lib/api/actions';
import type { Category } from '@/lib/types';

// Reexportado porque los componentes de categorías ya importaban el tipo desde
// aquí; la definición vive ahora en lib/api/actions.ts, compartida con las
// acciones de tareas y del temporizador.
export type { ActionResult };

export async function createCategoryAction(
  input: unknown
): Promise<ActionResult<Category>> {
  const parsed = parseInput(createCategorySchema, input);
  if (!parsed.ok) return parsed.result;

  try {
    const { supabase, userId } = await requireUser();
    const category = await new CategoryModel(supabase).create(parsed.data, userId);
    revalidatePath('/categories');
    return actionOk(category);
  } catch (e) {
    return actionError(e, 'No se pudo crear la categoría.');
  }
}

export async function updateCategoryAction(
  id: string,
  input: unknown
): Promise<ActionResult<Category>> {
  if (!uuid.safeParse(id).success) return actionErr('Identificador inválido.');

  const parsed = parseInput(createCategorySchema, input);
  if (!parsed.ok) return parsed.result;

  try {
    const { supabase, userId } = await requireUser();
    const category = await new CategoryModel(supabase).update(id, parsed.data, userId);
    revalidatePath('/categories');
    return actionOk(category);
  } catch (e) {
    return actionError(e, 'No se pudo actualizar la categoría.');
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult<null>> {
  if (!uuid.safeParse(id).success) return actionErr('Identificador inválido.');

  try {
    const { supabase, userId } = await requireUser();
    await new CategoryModel(supabase).delete(id, userId);
    revalidatePath('/categories');
    return actionOk(null);
  } catch (e) {
    return actionError(e, 'No se pudo eliminar la categoría.');
  }
}
