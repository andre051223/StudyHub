import { cache } from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; cookies will be set by middleware
          }
        },
      },
    }
  );
}

/**
 * Devuelve el usuario autenticado del request actual.
 *
 * `supabase.auth.getUser()` NO lee el JWT localmente: hace una petición HTTPS a
 * `/auth/v1/user` de Supabase para validarlo contra el servidor de auth. Como el
 * layout y cada página lo llamaban por separado, un mismo request pagaba dos o
 * tres viajes de red en serie antes de emitir el primer byte de HTML.
 *
 * `cache()` de React memoiza el resultado durante el render de un request, así
 * que layout + página comparten una sola llamada. El caché no se comparte entre
 * requests ni entre usuarios.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
