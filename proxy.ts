import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

// El proxy hace una llamada de red a Supabase (`auth.getUser()`) en cada request
// que intercepta. El matcher anterior era una exclusión genérica, así que se
// ejecutaba también en la landing estática, el manifest, los iconos, el service
// worker y todas las rutas /api — pagando ese viaje de red sin necesitarlo.
//
// Aquí solo listamos las rutas donde el proxy realmente aporta algo: refrescar
// la cookie de sesión y redirigir. Las rutas /api validan la sesión por su
// cuenta (lib/api/helpers.ts) y las páginas de recuperación de contraseña
// resuelven el código en el navegador.
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/notes/:path*',
    '/tasks/:path*',
    '/timer/:path*',
    '/agenda/:path*',
    '/categories/:path*',
    '/profile/:path*',
    '/login',
    '/register',
  ],
};
