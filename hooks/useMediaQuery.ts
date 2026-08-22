'use client';

import { useSyncExternalStore } from 'react';

/**
 * Suscripción a una media query.
 *
 * Se usa `useSyncExternalStore` en lugar de `useState` + `useEffect` porque el
 * snapshot del servidor es explícito: durante el render en servidor no hay
 * viewport, así que devuelve `false` y el cliente corrige en la hidratación.
 * Con `useEffect` habría un frame con el layout equivocado.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Ancho por debajo del breakpoint `md` de Tailwind. */
export const COMPACT_QUERY = '(max-width: 767px)';
