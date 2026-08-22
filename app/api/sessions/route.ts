import { NextRequest } from 'next/server';
import { SessionModel } from '@/lib/models';
import { createSessionSchema } from '@/lib/api/schemas';
import { getAuthContext, parseBody, isResponse, ok, errorResponse } from '@/lib/api/helpers';

export async function GET() {
  const ctx = await getAuthContext();
  if (isResponse(ctx)) return ctx;

  try {
    const model = new SessionModel(ctx.supabase);
    return ok(await model.findAllByUser(ctx.userId));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (isResponse(ctx)) return ctx;

  const body = await parseBody(req, createSessionSchema);
  if (isResponse(body)) return body;

  try {
    const model = new SessionModel(ctx.supabase);
    return ok(await model.create(body.data, ctx.userId), 201);
  } catch (e) {
    return errorResponse(e);
  }
}
