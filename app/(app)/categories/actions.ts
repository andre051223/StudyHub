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

/**
 * Las categorías no se pintan solo en /categories: las tres vistas de tareas y
 * el temporizador las leen embebidas (`select('*, category:categories(*)')`),
 * así que revalidar únicamente /categories dejaba el nombre o el color viejo en
 * pantalla al navegar a cualquiera de ellas.
 */
const CATEGORY_VIEWS = ['/categories', '/tasks', '/agenda', '/dashboard', '/timer'];

function revalidateCategoryViews() {
  for (const path of CATEGORY_VIEWS) revalidatePath(path);
}

export async function createCategoryAction(
  input: unknown
): Promise<ActionResult<Category>> {
  const parsed = parseInput(createCategorySchema, input);
  if (!parsed.ok) return parsed.result;

  try {
    const { supabase, userId } = await requireUser();
    const category = await new CategoryModel(supabase).create(parsed.data, userId);
    revalidateCategoryViews();
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
    revalidateCategoryViews();
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
    revalidateCategoryViews();
    return actionOk(null);
  } catch (e) {
    return actionError(e, 'No se pudo eliminar la categoría.');
  }
}
