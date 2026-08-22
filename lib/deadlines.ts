/**
 * Interpretación de las fechas límite de las tareas.
 *
 * `tasks.deadline` es un `timestamptz`, pero el formulario solo ofrece un
 * `<input type="date">`: escribe `YYYY-MM-DD`, que Postgres guarda como la
 * medianoche **UTC** de ese día. Leer ese instante con los getters locales
 * (`getDate()`) devuelve el día anterior en cualquier zona al oeste de
 * Greenwich — en Colombia, UTC−5, *todas* las fechas límite se mostraban y se
 * comparaban con un día de adelanto.
 *
 * Es el mismo error que `lib/stats.ts` corrigió para las sesiones, con el
 * signo cambiado: allí el instante es real y hay que agruparlo en local; aquí
 * el instante es una fecha de calendario disfrazada y hay que leerla en UTC.
 *
 * Este módulo centraliza esa lectura: `deadlineDay()` recupera el día natural
 * que el usuario eligió y lo devuelve como fecha local, para poder compararlo
 * con «hoy» sin volver a mezclar zonas.
 */

export type DeadlineStatus = 'overdue' | 'today' | 'tomorrow' | 'upcoming';

/** Medianoche **local** del día de calendario que representa `deadline`. */
export function deadlineDay(deadline: string | Date): Date {
  const d = deadline instanceof Date ? deadline : new Date(deadline);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Días de calendario entre hoy y la fecha límite. Negativo = ya venció. */
export function daysUntilDeadline(deadline: string | Date, now: Date = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = deadlineDay(deadline);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function deadlineStatus(deadline: string | Date, now: Date = new Date()): DeadlineStatus {
  const days = daysUntilDeadline(deadline, now);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return 'upcoming';
}

/** ¿Venció ya? Un plazo de hoy todavía no está vencido: queda el día entero. */
export function isOverdue(deadline: string | Date, now: Date = new Date()): boolean {
  return deadlineStatus(deadline, now) === 'overdue';
}

export function isDueToday(deadline: string | Date, now: Date = new Date()): boolean {
  return deadlineStatus(deadline, now) === 'today';
}

/**
 * Etiqueta legible: relativa cuando aporta («Hoy», «Ayer», «En 3 días») y
 * fecha absoluta cuando la distancia deja de ser intuitiva.
 */
export function formatDeadline(deadline: string | Date, now: Date = new Date()): string {
  const days = daysUntilDeadline(deadline, now);

  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  if (days === -1) return 'Ayer';
  if (days < -1 && days >= -7) return `Hace ${-days} días`;
  if (days > 1 && days <= 7) return `En ${days} días`;

  return deadlineDay(deadline).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    ...(deadlineDay(deadline).getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/**
 * Límite superior para consultar «lo que vence hoy o antes» sin traerse el
 * resto: el instante UTC más tardío que sigue perteneciendo al día de hoy.
 */
export function endOfTodayForQuery(now: Date = new Date()): string {
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  ).toISOString();
}
