'use client';

import { useSyncExternalStore } from 'react';

/**
 * La fecha de hoy, en la zona horaria del usuario.
 *
 * No se puede renderizar en el servidor: allí «hoy» es el día en UTC, así que
 * a partir de las 19:00 en Colombia el saludo mostraría ya la fecha de mañana.
 *
 * `useSyncExternalStore` con un snapshot de servidor vacío es la forma
 * soportada de decir «esto solo existe en el cliente»: React renderiza el
 * hueco en el HTML y vuelve a renderizar con el valor real tras la
 * hidratación, sin desajuste. No hay nada a lo que suscribirse, de ahí la
 * función de baja vacía.
 */
const noSubscription = () => () => {};

function localToday(): string {
  return new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function LocalDate() {
  const today = useSyncExternalStore(noSubscription, localToday, () => null);

  return <p className="text-meta mt-1 capitalize min-h-[1.1em]">{today ?? ''}</p>;
}
