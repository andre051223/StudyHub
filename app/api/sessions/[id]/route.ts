import { NextRequest } from 'next/server';
import { SessionModel } from '@/lib/models';
import { updateSessionSchema, uuid } from '@/lib/api/schemas';
import { getAuthContext, parseBody, isResponse, ok, err, errorResponse } from '@/lib/api/helpers';

/**
 * Sesión individual. Existe por paridad con el resto de recursos REST: hasta
 * ahora `study_sessions` era el único que se podía crear pero no corregir ni
 * borrar, ni desde la interfaz ni desde la API.
 */

/** Valida el segmento de ruta antes de tocar la base. */
async function resolveId(params: Promise<{ id: string }>) {
  const { id } = await params;
  return uuid.safeParse(id).success ? id : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (isResponse(ctx)) return ctx;

  const id = await resolveId(params);
  if (!id) return err('Identificador inválido.', 400);

  try {
    const model = new SessionModel(ctx.supabase);
    const item = await model.findById(id, ctx.userId);
    if (!item) return err('Sesión no encontrada', 404);
    return ok(item);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (isResponse(ctx)) return ctx;

  const id = await resolveId(params);
  if (!id) return err('Identificador inválido.', 400);

  const body = await parseBody(req, updateSessionSchema);
  if (isResponse(body)) return body;

  try {
    const model = new SessionModel(ctx.supabase);
    return ok(await model.update(id, body.data, ctx.userId));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext();
  if (isResponse(ctx)) return ctx;

  const id = await resolveId(params);
  if (!id) return err('Identificador inválido.', 400);

  try {
    const model = new SessionModel(ctx.supabase);
    await model.delete(id, ctx.userId);
    return ok({ deleted: true });
  } catch (e) {
    return errorResponse(e);
  }
}
