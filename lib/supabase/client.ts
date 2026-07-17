'use client';

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Si las variables no quedaron inyectadas en el bundle (p. ej. el build se hizo
// antes de configurar .env.local, o falta reiniciar el dev server), el cliente
// terminaría haciendo fetch a una URL inválida y el usuario solo vería un
// críptico "Failed to fetch". Fallamos con un mensaje claro que apunta al origen.
if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project-id')) {
  throw new Error(
    'Configuración de Supabase ausente en el cliente. Verifica NEXT_PUBLIC_SUPABASE_URL y ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local y reinicia el servidor (o vuelve a hacer build).'
  );
}

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
