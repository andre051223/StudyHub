import { describe, it, expect } from 'vitest';
import {
  localDayKey,
  startOfLocalDay,
  startOfLocalWeek,
  onlyCompleted,
  minutesOnDay,
  minutesSince,
  minutesThisWeek,
  minutesSinceMonday,
  dailyBuckets,
  currentStreak,
  dailyAverage,
  categoryTotals,
  summarize,
  formatMinutes,
  type StatsSession,
} from './stats';

/**
 * Los tests corren con TZ=America/Bogota (UTC−5), fijado en vitest.config.ts.
 * Es deliberado: la zona con offset negativo es la que destapa el bug de
 * agrupar días en UTC, y es la zona real de los usuarios de StudyHub.
 */

/** Construye una sesión con hora **local**, como la viviría el usuario. */
function session(
  local: { y: number; m: number; d: number; h?: number; min?: number },
  minutes: number,
  opts: { completed?: boolean; category?: { name: string; color: string } } = {}
): StatsSession {
  const started = new Date(local.y, local.m - 1, local.d, local.h ?? 10, local.min ?? 0);
  return {
    started_at: started.toISOString(),
    actual_duration_seconds: Math.round(minutes * 60),
    completed_at: opts.completed === false ? null : new Date(started.getTime() + 1000).toISOString(),
    category: opts.category ?? null,
  };
}

/** Sesión medida en segundos exactos, para comprobar el redondeo. */
function sessionSeconds(local: { y: number; m: number; d: number; h?: number }, seconds: number): StatsSession {
  const s = session(local, 0);
  return { ...s, actual_duration_seconds: seconds };
}

const NOW = new Date(2026, 7, 22, 14, 0); // sábado 22 de agosto de 2026, 14:00 local

describe('localDayKey', () => {
  it('agrupa una sesión nocturna en su día local, no en el siguiente día UTC', () => {
    // 22:30 en Bogotá son las 03:30 UTC del día siguiente. Ese desfase era el
    // bug: el estudio de la noche se contaba como del día siguiente.
    const nocturna = new Date(2026, 7, 22, 22, 30);

    expect(localDayKey(nocturna)).toBe('2026-08-22');
    expect(nocturna.toISOString().slice(0, 10)).toBe('2026-08-23'); // el método viejo
  });

  it('acepta strings ISO, números y Date', () => {
    const d = new Date(2026, 0, 5, 8, 0);
    expect(localDayKey(d)).toBe('2026-01-05');
    expect(localDayKey(d.toISOString())).toBe('2026-01-05');
    expect(localDayKey(d.getTime())).toBe('2026-01-05');
  });

  it('rellena mes y día con cero a la izquierda', () => {
    expect(localDayKey(new Date(2026, 2, 3, 12, 0))).toBe('2026-03-03');
  });
});

describe('startOfLocalDay / startOfLocalWeek', () => {
  it('startOfLocalDay devuelve la medianoche local', () => {
    const d = startOfLocalDay(new Date(2026, 7, 22, 23, 59));
    expect(d.getHours()).toBe(0);
    expect(localDayKey(d)).toBe('2026-08-22');
  });

  it('startOfLocalWeek devuelve el lunes de esa semana', () => {
    // 22/08/2026 es sábado; su lunes es el 17.
    expect(localDayKey(startOfLocalWeek(NOW))).toBe('2026-08-17');
  });

  it('para un domingo devuelve el lunes anterior, no el siguiente', () => {
    const domingo = new Date(2026, 7, 23, 10, 0);
    expect(localDayKey(startOfLocalWeek(domingo))).toBe('2026-08-17');
  });

  it('un lunes es su propio inicio de semana', () => {
    const lunes = new Date(2026, 7, 17, 9, 0);
    expect(localDayKey(startOfLocalWeek(lunes))).toBe('2026-08-17');
  });
});

describe('onlyCompleted', () => {
  it('descarta las sesiones abandonadas', () => {
    const sessions = [
      session({ y: 2026, m: 8, d: 22 }, 30),
      session({ y: 2026, m: 8, d: 22 }, 45, { completed: false }),
    ];
    expect(onlyCompleted(sessions)).toHaveLength(1);
  });
});

describe('minutos estudiados', () => {
  it('usa el tiempo real, no la duración planeada', () => {
    // Sesión planeada de 60 min detenida a los 3: debe contar 3.
    const s = session({ y: 2026, m: 8, d: 22 }, 3);
    expect(minutesOnDay([s], NOW)).toBe(3);
  });

  it('redondea una sola vez al final, no sesión por sesión', () => {
    // 3 × 100 s = 300 s = 5 min exactos.
    // Redondeando cada sesión (100 s → 2 min) darían 6, que es el error clásico.
    const sessions = [
      sessionSeconds({ y: 2026, m: 8, d: 22 }, 100),
      sessionSeconds({ y: 2026, m: 8, d: 22 }, 100),
      sessionSeconds({ y: 2026, m: 8, d: 22 }, 100),
    ];
    expect(minutesOnDay(sessions, NOW)).toBe(5);
  });

  it('cuenta una sesión nocturna en el día en que empezó', () => {
    const nocturna = session({ y: 2026, m: 8, d: 22, h: 22, min: 30 }, 40);
    expect(minutesOnDay([nocturna], new Date(2026, 7, 22, 23, 59))).toBe(40);
    expect(minutesOnDay([nocturna], new Date(2026, 7, 23, 10, 0))).toBe(0);
  });

  it('minutesSince incluye el instante exacto del límite', () => {
    const s = session({ y: 2026, m: 8, d: 20, h: 0, min: 0 }, 25);
    expect(minutesSince([s], new Date(2026, 7, 20, 0, 0))).toBe(25);
    expect(minutesSince([s], new Date(2026, 7, 20, 0, 1))).toBe(0);
  });

  it('minutesThisWeek cubre los últimos 7 días naturales, incluido hoy', () => {
    const sessions = [
      session({ y: 2026, m: 8, d: 22 }, 30), // hoy
      session({ y: 2026, m: 8, d: 16 }, 20), // hace 6 días → dentro
      session({ y: 2026, m: 8, d: 15 }, 99), // hace 7 días → fuera
    ];
    expect(minutesThisWeek(sessions, NOW)).toBe(50);
  });

  it('minutesSinceMonday solo cuenta desde el lunes de la semana en curso', () => {
    const sessions = [
      session({ y: 2026, m: 8, d: 22 }, 30), // sábado, esta semana
      session({ y: 2026, m: 8, d: 17 }, 20), // lunes, esta semana
      session({ y: 2026, m: 8, d: 16 }, 99), // domingo anterior → fuera
    ];
    expect(minutesSinceMonday(sessions, NOW)).toBe(50);
  });
});

describe('dailyBuckets', () => {
  it('devuelve un bucket por día en orden cronológico', () => {
    const buckets = dailyBuckets([], 7, NOW);
    expect(buckets).toHaveLength(7);
    expect(buckets[0].key).toBe('2026-08-16');
    expect(buckets[6].key).toBe('2026-08-22');
  });

  it('incluye los días sin estudio como cero', () => {
    const buckets = dailyBuckets([session({ y: 2026, m: 8, d: 22 }, 45)], 7, NOW);
    expect(buckets.map((b) => b.minutes)).toEqual([0, 0, 0, 0, 0, 0, 45]);
  });

  it('agrega varias sesiones del mismo día', () => {
    const sessions = [
      session({ y: 2026, m: 8, d: 20, h: 9 }, 25),
      session({ y: 2026, m: 8, d: 20, h: 16 }, 35),
    ];
    const buckets = dailyBuckets(sessions, 7, NOW);
    expect(buckets.find((b) => b.key === '2026-08-20')?.minutes).toBe(60);
  });

  it('coloca la sesión nocturna en su día local', () => {
    const buckets = dailyBuckets([session({ y: 2026, m: 8, d: 21, h: 23 }, 30)], 7, NOW);
    expect(buckets.find((b) => b.key === '2026-08-21')?.minutes).toBe(30);
    expect(buckets.find((b) => b.key === '2026-08-22')?.minutes).toBe(0);
  });
});

describe('currentStreak', () => {
  it('cuenta días consecutivos terminando hoy', () => {
    const sessions = [
      session({ y: 2026, m: 8, d: 22 }, 30),
      session({ y: 2026, m: 8, d: 21 }, 30),
      session({ y: 2026, m: 8, d: 20 }, 30),
    ];
    expect(currentStreak(sessions, NOW)).toBe(3);
  });

  it('sigue viva si aún no has estudiado hoy pero sí ayer', () => {
    const sessions = [
      session({ y: 2026, m: 8, d: 21 }, 30),
      session({ y: 2026, m: 8, d: 20 }, 30),
    ];
    expect(currentStreak(sessions, NOW)).toBe(2);
  });

  it('se rompe si la última sesión fue hace dos días', () => {
    expect(currentStreak([session({ y: 2026, m: 8, d: 20 }, 30)], NOW)).toBe(0);
  });

  it('cuenta un día una sola vez aunque tenga varias sesiones', () => {
    const sessions = [
      session({ y: 2026, m: 8, d: 22, h: 9 }, 30),
      session({ y: 2026, m: 8, d: 22, h: 15 }, 30),
      session({ y: 2026, m: 8, d: 21 }, 30),
    ];
    expect(currentStreak(sessions, NOW)).toBe(2);
  });

  it('no se rompe por una sesión nocturna', () => {
    // Con la agrupación en UTC, la sesión del 21 a las 23:00 caía en el 22 y
    // dejaba el 21 vacío: la racha se partía por la mitad.
    const sessions = [
      session({ y: 2026, m: 8, d: 22, h: 10 }, 30),
      session({ y: 2026, m: 8, d: 21, h: 23 }, 30),
      session({ y: 2026, m: 8, d: 20, h: 23 }, 30),
    ];
    expect(currentStreak(sessions, NOW)).toBe(3);
  });

  it('devuelve 0 sin sesiones', () => {
    expect(currentStreak([], NOW)).toBe(0);
  });

  it('atraviesa un cambio de mes', () => {
    const now = new Date(2026, 8, 1, 12, 0); // 1 de septiembre
    const sessions = [
      session({ y: 2026, m: 9, d: 1 }, 30),
      session({ y: 2026, m: 8, d: 31 }, 30),
      session({ y: 2026, m: 8, d: 30 }, 30),
    ];
    expect(currentStreak(sessions, now)).toBe(3);
  });
});

describe('dailyAverage', () => {
  it('divide entre los días transcurridos, no entre los días con sesión', () => {
    // 140 min repartidos en 2 días, sobre una ventana de 7 → 20, no 70.
    const sessions = [
      session({ y: 2026, m: 8, d: 22 }, 70),
      session({ y: 2026, m: 8, d: 21 }, 70),
    ];
    expect(dailyAverage(sessions, 7, NOW)).toBe(20);
  });

  it('ignora lo que queda fuera de la ventana', () => {
    const sessions = [
      session({ y: 2026, m: 8, d: 22 }, 70),
      session({ y: 2026, m: 8, d: 1 }, 700),
    ];
    expect(dailyAverage(sessions, 7, NOW)).toBe(10);
  });

  it('devuelve 0 sin sesiones', () => {
    expect(dailyAverage([], 7, NOW)).toBe(0);
  });
});

describe('categoryTotals', () => {
  const calculo = { name: 'Cálculo', color: '#67b31f' };
  const historia = { name: 'Historia', color: '#3b82f6' };

  it('suma por categoría y ordena de mayor a menor', () => {
    const sessions = [
      session({ y: 2026, m: 8, d: 22 }, 30, { category: historia }),
      session({ y: 2026, m: 8, d: 21 }, 50, { category: calculo }),
      session({ y: 2026, m: 8, d: 20 }, 20, { category: calculo }),
    ];
    const totals = categoryTotals(sessions);
    expect(totals).toEqual([
      { name: 'Cálculo', color: '#67b31f', minutes: 70 },
      { name: 'Historia', color: '#3b82f6', minutes: 30 },
    ]);
  });

  it('ignora las sesiones sin categoría', () => {
    const sessions = [
      session({ y: 2026, m: 8, d: 22 }, 30),
      session({ y: 2026, m: 8, d: 22 }, 30, { category: calculo }),
    ];
    expect(categoryTotals(sessions)).toHaveLength(1);
  });

  it('acepta la relación incrustada como array, que es como la devuelve Supabase a veces', () => {
    const s: StatsSession = {
      ...session({ y: 2026, m: 8, d: 22 }, 40),
      category: [calculo],
    };
    expect(categoryTotals([s])[0].minutes).toBe(40);
  });

  it('respeta el filtro `from`', () => {
    const sessions = [
      session({ y: 2026, m: 8, d: 22 }, 30, { category: calculo }),
      session({ y: 2026, m: 7, d: 10 }, 90, { category: calculo }),
    ];
    expect(categoryTotals(sessions, new Date(2026, 7, 1))[0].minutes).toBe(30);
  });
});

describe('summarize', () => {
  it('descarta las sesiones abandonadas en todas las métricas', () => {
    const sessions = [
      session({ y: 2026, m: 8, d: 22 }, 40),
      session({ y: 2026, m: 8, d: 22 }, 999, { completed: false }),
    ];
    const s = summarize(sessions, NOW);
    expect(s.minutesToday).toBe(40);
    expect(s.minutesThisWeek).toBe(40);
    expect(s.currentStreak).toBe(1);
  });

  it('elige la categoría más estudiada del mes en curso', () => {
    const sessions = [
      session({ y: 2026, m: 8, d: 22 }, 30, { category: { name: 'Historia', color: '#3b82f6' } }),
      session({ y: 2026, m: 8, d: 5 }, 90, { category: { name: 'Cálculo', color: '#67b31f' } }),
      // Julio: mucho tiempo, pero es de otro mes y no debe ganar.
      session({ y: 2026, m: 7, d: 5 }, 900, { category: { name: 'Física', color: '#f97316' } }),
    ];
    expect(summarize(sessions, NOW).topCategoryThisMonth).toBe('Cálculo');
  });

  it('devuelve ceros y null cuando no hay sesiones', () => {
    expect(summarize([], NOW)).toEqual({
      minutesThisWeek: 0,
      minutesSinceMonday: 0,
      minutesToday: 0,
      currentStreak: 0,
      dailyAverage: 0,
      topCategoryThisMonth: null,
    });
  });
});

describe('formatMinutes', () => {
  it('muestra solo minutos por debajo de una hora', () => {
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(45)).toBe('45m');
  });

  it('muestra horas y minutos por encima', () => {
    expect(formatMinutes(60)).toBe('1h 0m');
    expect(formatMinutes(95)).toBe('1h 35m');
    expect(formatMinutes(605)).toBe('10h 5m');
  });
});
