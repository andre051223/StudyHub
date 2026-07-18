'use client';

import { createBrowserClient } from '@supabase/ssr';

// Si las variables no quedaron inyectadas en el bundle (p. ej. el build se hizo
// antes de configurar .env.local, o falta reiniciar el dev server), el cliente
// terminaría haciendo fetch a una URL inválida y el usuario solo vería un
// críptico "Failed to fetch". Fallamos con un mensaje claro que apunta al origen.
function getSupabaseConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || url.includes('your-project-id')) {
    throw new Error(
      'Configuración de Supabase ausente en el cliente. Verifica NEXT_PUBLIC_SUPABASE_URL y ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local y reinicia el servidor (o vuelve a hacer build).'
    );
  }

  return { url, anonKey };
}

export function createClient() {
  const { url, anonKey } = getSupabaseConfig();
  return createBrowserClient(url, anonKey);
}
