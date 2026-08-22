import { describe, it, expect } from 'vitest';
import {
  deadlineDay,
  daysUntilDeadline,
  deadlineStatus,
  isOverdue,
  isDueToday,
  formatDeadline,
  endOfTodayForQuery,
} from './deadlines';

/**
 * Igual que `stats.test.ts`, estos tests corren con TZ=America/Bogota (UTC−5).
 * Es la zona que destapa el bug: una fecha límite guardada como
 * `2026-08-22T00:00:00Z` leída con getters locales cae el 21 de agosto a las
 * 19:00, así que *toda* fecha límite se mostraba y se comparaba con un día de
 * adelanto.
 */

/** Como lo guarda Postgres cuando el formulario envía `YYYY-MM-DD`. */
function deadline(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString();
}

/** Un instante local, como el «ahora» del navegador del usuario. */
function now(y: number, m: number, d: number, h = 10): Date {
  return new Date(y, m - 1, d, h);
}

describe('deadlineDay', () => {
  it('recupera el día de calendario que eligió el usuario', () => {
    const day = deadlineDay(deadline(2026, 8, 22));
    expect(day.getFullYear()).toBe(2026);
    expect(day.getMonth()).toBe(7);
    expect(day.getDate()).toBe(22);
  });

  it('no se desplaza al día anterior en zonas con offset negativo', () => {
    // Es exactamente lo que hacía `new Date(iso).getDate()`.
    expect(new Date(deadline(2026, 8, 22)).getDate()).toBe(21);
    expect(deadlineDay(deadline(2026, 8, 22)).getDate()).toBe(22);
  });

  it('devuelve medianoche local, apta para comparar con hoy', () => {
    const day = deadlineDay(deadline(2026, 8, 22));
    expect(day.getHours()).toBe(0);
    expect(day.getMinutes()).toBe(0);
  });
});

describe('daysUntilDeadline', () => {
  it('cuenta días de calendario, no periodos de 24 horas', () => {
    // Faltan menos de 24 horas reales, pero es «mañana».
    expect(daysUntilDeadline(deadline(2026, 8, 23), now(2026, 8, 22, 23))).toBe(1);
  });

  it('es negativo cuando ya venció', () => {
    expect(daysUntilDeadline(deadline(2026, 8, 19), now(2026, 8, 22))).toBe(-3);
  });

  it('es cero el mismo día, a cualquier hora', () => {
    expect(daysUntilDeadline(deadline(2026, 8, 22), now(2026, 8, 22, 0))).toBe(0);
    expect(daysUntilDeadline(deadline(2026, 8, 22), now(2026, 8, 22, 23))).toBe(0);
  });

  it('atraviesa el cambio de mes', () => {
    expect(daysUntilDeadline(deadline(2026, 9, 1), now(2026, 8, 31))).toBe(1);
  });
});

describe('deadlineStatus', () => {
  it('clasifica los cuatro casos', () => {
    const today = now(2026, 8, 22);
    expect(deadlineStatus(deadline(2026, 8, 21), today)).toBe('overdue');
    expect(deadlineStatus(deadline(2026, 8, 22), today)).toBe('today');
    expect(deadlineStatus(deadline(2026, 8, 23), today)).toBe('tomorrow');
    expect(deadlineStatus(deadline(2026, 8, 30), today)).toBe('upcoming');
  });

  it('una tarea que vence hoy todavía no está vencida', () => {
    // Queda el día entero para hacerla: marcarla en rojo desde las 00:01 era
    // el efecto de comparar el instante en vez del día.
    expect(isOverdue(deadline(2026, 8, 22), now(2026, 8, 22, 23))).toBe(false);
    expect(isDueToday(deadline(2026, 8, 22), now(2026, 8, 22, 23))).toBe(true);
  });
});

describe('formatDeadline', () => {
  it('usa etiquetas relativas cuando aportan', () => {
    const today = now(2026, 8, 22);
    expect(formatDeadline(deadline(2026, 8, 22), today)).toBe('Hoy');
    expect(formatDeadline(deadline(2026, 8, 23), today)).toBe('Mañana');
    expect(formatDeadline(deadline(2026, 8, 21), today)).toBe('Ayer');
    expect(formatDeadline(deadline(2026, 8, 19), today)).toBe('Hace 3 días');
    expect(formatDeadline(deadline(2026, 8, 26), today)).toBe('En 4 días');
  });

  it('vuelve a la fecha absoluta cuando la distancia deja de ser intuitiva', () => {
    const label = formatDeadline(deadline(2026, 9, 15), now(2026, 8, 22));
    expect(label).not.toMatch(/días/);
    expect(label).toContain('15');
  });

  it('incluye el año solo si es distinto del actual', () => {
    expect(formatDeadline(deadline(2027, 1, 10), now(2026, 8, 22))).toContain('2027');
    expect(formatDeadline(deadline(2026, 12, 10), now(2026, 8, 22))).not.toContain('2026');
  });
});

describe('endOfTodayForQuery', () => {
  it('acota hasta el final del día local, expresado como instante UTC', () => {
    const bound = endOfTodayForQuery(now(2026, 8, 22, 19));
    expect(bound).toBe('2026-08-22T23:59:59.999Z');
  });

  it('deja pasar lo que vence hoy y corta lo de mañana', () => {
    const bound = endOfTodayForQuery(now(2026, 8, 22));
    expect(deadline(2026, 8, 22) <= bound).toBe(true);
    expect(deadline(2026, 8, 23) <= bound).toBe(false);
  });
});
