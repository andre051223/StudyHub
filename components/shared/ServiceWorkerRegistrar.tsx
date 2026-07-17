'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // En desarrollo el service worker cachea los chunks de la app (Turbopack/HMR),
    // lo que puede servir un bundle obsoleto —por ejemplo uno construido antes de
    // configurar las variables de Supabase— y provocar fallos de red ("Failed to
    // fetch") aunque el servidor esté correcto. Por eso solo lo registramos en
    // producción y, en desarrollo, limpiamos cualquier registro/caché previo.
    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    } else {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
    }
  }, []);

  return null;
}
