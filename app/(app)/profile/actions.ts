'use server';

import { revalidatePath } from 'next/cache';
import { updateProfileSchema } from '@/lib/api/schemas';
import {
  requireUser,
  parseInput,
  actionOk,
  actionError,
  type ActionResult,
} from '@/lib/api/actions';

export async function updateProfileAction(
  input: unknown
): Promise<ActionResult<{ full_name: string }>> {
  const parsed = parseInput(updateProfileSchema, input);
  if (!parsed.ok) return parsed.result;

  try {
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: parsed.data.full_name })
      .eq('id', userId)
      .select('full_name')
      .single();
    if (error) throw new Error('No se pudo guardar el perfil.');

    // El nombre se muestra en la Navbar, que vive en el layout de (app).
    revalidatePath('/', 'layout');
    return actionOk(data);
  } catch (e) {
    return actionError(e, 'No se pudo guardar el perfil.');
  }
}
