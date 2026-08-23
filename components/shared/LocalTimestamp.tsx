'use client';

import { useSyncExternalStore } from 'react';
import { formatDate, formatDateTime, formatTime } from '@/lib/utils';

/**
 * Un instante guardado, formateado en la zona y el idioma del **navegador**.
 *
 * Formatear una fecha durante el render de servidor produce un desajuste de
 * hidratación por dos motivos independientes, y basta con uno para que React
 * descarte y regenere el árbol:
 *
 * 1. **Zona horaria.** `'use client'` no evita el render en servidor: solo
 *    marca dónde vive la interactividad. En Vercel el proceso corre en UTC, así
 *    que una sesión de las 14:00 en Colombia se sirve como «07:00 p. m.» y el
 *    navegador la vuelve a pintar como «02:00 p. m.».
 *
 * 2. **Versión de ICU.** Node y el navegador empaquetan datos CLDR distintos.
 *    Para `es-CO` eso cambia el texto aunque la zona coincida —«22 de ago de
 *    2026» frente a «22 ago 2026»—, que es el caso que se dispara en local,
 *    donde ambos comparten zona.
 *
 * La solución es la misma que ya usa `LocalDate`: `useSyncExternalStore` con un
 * snapshot de servidor nulo. React sirve el hueco vacío, hidrata sin comparar
 * nada y vuelve a renderizar con el valor real. El `<time dateTime>` conserva
 * el instante exacto en el HTML servido, así que el dato sigue estando ahí para
 * quien lo lea sin ejecutar JavaScript.
 */

const FORMATTERS = {
  /** `22 ago 2026` */
  date: formatDate,
  /** `22 ago 2026, 14:30` */
  datetime: formatDateTime,
  /** `14:30` */
  time: formatTime,
} as const;

/** No hay nada a lo que suscribirse: el valor no cambia solo. */
const noSubscription = () => () => {};

interface Props {
  /** Instante en ISO, tal cual lo devuelve Postgres. */
  value: string;
  format?: keyof typeof FORMATTERS;
}

export function LocalTimestamp({ value, format = 'datetime' }: Props) {
  const text = useSyncExternalStore(
    noSubscription,
    () => FORMATTERS[format](value),
    () => null
  );

  return (
    <time dateTime={value}>{text ?? ''}</time>
  );
}
