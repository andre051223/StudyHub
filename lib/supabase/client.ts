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
      'Faltan las variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL y ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY). En local: defínelas en .env.local y reinicia el ' +
        'servidor. En el despliegue (Vercel/Netlify/etc.): configúralas en el panel de ' +
        'variables de entorno del proyecto y vuelve a desplegar, ya que .env.local NO se sube ' +
        'al repositorio y Next.js incrusta estas variables durante el build.'
    );
  }

  return { url, anonKey };
}

export function createClient() {
  const { url, anonKey } = getSupabaseConfig();
  return createBrowserClient(url, anonKey);
}
