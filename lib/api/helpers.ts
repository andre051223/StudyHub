import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { ZodType } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ModelError } from '@/lib/models';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuthContext {
  supabase: SupabaseClient;
  userId: string;
}

export async function getAuthContext(): Promise<AuthContext | NextResponse> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  return { supabase, userId: user.id };
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Lee el body y lo valida contra un esquema.
 *
 * Antes los handlers hacían `model.create(await req.json(), userId)` con el
 * body sin filtrar: era `any` y llegaba entero a un `insert`. Devuelve el dato
 * ya tipado o una respuesta 400 con los errores por campo.
 */
export async function parseBody<T>(
  req: NextRequest,
  schema: ZodType<T>
): Promise<{ data: T } | NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return err('El cuerpo de la petición no es JSON válido.', 400);
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Datos inválidos.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }
  return { data: parsed.data };
}

/** `true` si el valor es una respuesta de error devuelta por los helpers. */
export function isResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

/**
 * Traduce una excepción de la capa de modelos a una respuesta HTTP.
 *
 * Antes todo error se devolvía como 400 con `(e as Error).message`, lo que
 * mezclaba tres cosas distintas —recurso inexistente, entrada inválida y fallo
 * de base de datos— y filtraba al cliente el mensaje crudo de Postgres.
 */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof ModelError) {
    // Los errores de PostgREST/Postgres son fallos de servidor o de permisos:
    // su mensaje describe el esquema, así que no se reenvía al cliente.
    console.error('[api] ModelError', e.code, e.message);
    if (e.code === '23505') return err('Ese registro ya existe.', 409);
    if (e.code === '23503') return err('Referencia inválida.', 400);
    if (e.code === '42501') return err('No autorizado', 403);
    return err('No se pudo completar la operación.', 500);
  }

  if (e instanceof Error) {
    // Reglas de negocio lanzadas por los modelos con mensajes pensados para
    // el usuario ("Tarea no encontrada.", "El título no puede estar vacío.").
    const notFound = /no encontrad[ao]/i.test(e.message);
    return err(e.message, notFound ? 404 : 400);
  }

  console.error('[api] error desconocido', e);
  return err('Error inesperado.', 500);
}
