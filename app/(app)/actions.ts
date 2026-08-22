'use server';

import { SearchModel, type SearchHit } from '@/lib/models';
import { searchSchema } from '@/lib/api/schemas';
import {
  requireUser,
  parseInput,
  actionOk,
  actionError,
  type ActionResult,
} from '@/lib/api/actions';

/**
 * Búsqueda global (D4).
 *
 * Vive en el layout del área autenticada porque la paleta de comandos también:
 * se abre desde cualquier pantalla con Ctrl+K, así que no pertenece a ninguna
 * ruta en concreto.
 *
 * Pasa por Server Action y no por consulta directa desde el navegador por dos
 * razones: el término se valida antes de tocar la base, y la llamada al RPC
 * queda en un solo sitio en lugar de repetirse en cada componente que quiera
 * buscar.
 */
export async function searchAction(input: unknown): Promise<ActionResult<SearchHit[]>> {
  const parsed = parseInput(searchSchema, input);
  if (!parsed.ok) return parsed.result;

  try {
    const { supabase } = await requireUser();
    const hits = await new SearchModel(supabase).search(parsed.data.q, parsed.data.limit);
    return actionOk(hits);
  } catch (e) {
    return actionError(e, 'No se pudo completar la búsqueda.');
  }
}
