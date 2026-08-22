import { NextRequest } from 'next/server';
import { NoteModel } from '@/lib/models';
import { createNoteSchema } from '@/lib/api/schemas';
import { getAuthContext, parseBody, isResponse, ok, errorResponse } from '@/lib/api/helpers';

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (isResponse(ctx)) return ctx;

  try {
    const model = new NoteModel(ctx.supabase);
    const q = req.nextUrl.searchParams.get('q');
    // `search` ya no recibe userId: filtra por RLS a través de la función
    // `search_everything` (migración 007). Ver la nota en NoteModel.search.
    return ok(q ? await model.search(q) : await model.findAllByUser(ctx.userId));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (isResponse(ctx)) return ctx;

  const body = await parseBody(req, createNoteSchema);
  if (isResponse(body)) return body;

  try {
    const model = new NoteModel(ctx.supabase);
    return ok(await model.create(body.data, ctx.userId), 201);
  } catch (e) {
    return errorResponse(e);
  }
}
