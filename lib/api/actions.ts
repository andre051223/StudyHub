/**
 * Contrato compartido de las Server Actions.
 *
 * Las acciones **no lanzan** hacia el cliente: devuelven un resultado
 * discriminado. Una excepción en una Server Action llega al navegador como un
 * error genérico y opaco en producción, así que los fallos previsibles
 * —validación, reglas de negocio— se modelan como datos.
 */
import type { ZodType } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ModelError } from '@/lib/models';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionErr<T>(
  error: string,
  fieldErrors?: Record<string, string[]>
): ActionResult<T> {
  return { ok: false, error, fieldErrors };
}

/**
 * Traduce una excepción a un `ActionResult` de error.
 *
 * Mismo criterio que `errorResponse()` en `lib/api/helpers.ts`: los mensajes
 * de los modelos están escritos para el usuario y se muestran tal cual; los de
 * Postgres describen el esquema y se registran en el servidor sin reenviarse.
 */
export function actionError<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof ModelError) {
    console.error('[action] ModelError', e.code, e.message);
    if (e.code === '23505') return actionErr('Ese registro ya existe.');
    return actionErr(fallback);
  }
  if (e instanceof Error) return actionErr(e.message);
  console.error('[action] error desconocido', e);
  return actionErr(fallback);
}

export interface ActionContext {
  supabase: SupabaseClient;
  userId: string;
}

/**
 * Sesión del request. Lanza si no hay usuario: cada acción envuelve su cuerpo
 * en try/catch, así que el fallo acaba convertido en `ActionResult` de error.
 */
export async function requireUser(): Promise<ActionContext> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('No autenticado.');
  return { supabase, userId: user.id };
}

/** Valida una entrada contra un esquema y devuelve los errores por campo. */
export function parseInput<T>(
  schema: ZodType<T>,
  input: unknown
): { ok: true; data: T } | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    result: actionErr(
      'Datos inválidos.',
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    ),
  };
}
