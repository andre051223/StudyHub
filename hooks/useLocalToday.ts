'use client';

import { useSyncExternalStore } from 'react';

/**
 * El día de hoy en la zona del **navegador**, como medianoche local en ms.
 *
 * Devuelve `null` durante el render de servidor y durante la hidratación; el
 * valor real llega en el siguiente render. Quien lo use tiene que saber pintar
 * ese hueco.
 *
 * ── Por qué no basta con `new Date()` ──────────────────────────
 *
 * `'use client'` no evita el render en servidor: solo marca dónde vive la
 * interactividad. En Vercel el proceso corre en UTC, así que cualquier
 * componente que calcule «hoy» durante el render produce dos verdades
 * distintas —a partir de las 19:00 en Colombia, el servidor ya está en el día
 * siguiente— y React descarta el árbol por desajuste de hidratación. Peor que
 * el aviso es el dato: la racha se rompía sola y un plazo de hoy se anunciaba
 * como vencido.
 *
 * ── Por qué el día y no el instante ───────────────────────────
 *
 * Todos los consumidores (metas, racha, semana de la agenda, etiquetas de
 * plazo) solo miran la parte de fecha. Devolver la medianoche lo hace
 * explícito y, de paso, cumple el contrato de `useSyncExternalStore`: el
 * snapshot tiene que ser estable entre llamadas o React entra en un bucle de
 * renders. Un `Date.now()` daría un número distinto cada vez; la medianoche
 * local es la misma todo el día y cambia sola al pasar a mañana.
 */

/** No hay nada a lo que suscribirse: el día no cambia por un evento. */
const noSubscription = () => () => {};

function startOfLocalTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function useLocalToday(): number | null {
  return useSyncExternalStore(noSubscription, startOfLocalTodayMs, () => null);
}
