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
  categoryBreakdown,
  rangeStart,
  comparePeriods,
  hourBlocks,
  bestHourBlock,
  focusTotals,
  heatmapWeeks,
  heatmapWeekSpan,
  heatmapLevel,
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

describe('rangeStart', () => {
  // Sábado 22 de agosto de 2026, 14:30 hora local.
  const now = new Date(2026, 7, 22, 14, 30);

  it('«día» arranca en la medianoche local de hoy', () => {
    expect(rangeStart('day', now)).toEqual(new Date(2026, 7, 22, 0, 0, 0, 0));
  });

  it('«semana» arranca el lunes, no siete días atrás', () => {
    expect(rangeStart('week', now)).toEqual(new Date(2026, 7, 17, 0, 0, 0, 0));
  });

  it('«mes» arranca el día 1, no treinta días atrás', () => {
    expect(rangeStart('month', now)).toEqual(new Date(2026, 7, 1, 0, 0, 0, 0));
  });
});

describe('categoryBreakdown', () => {
  const calculo = { name: 'Cálculo', color: '#67b31f' };
  const historia = { name: 'Historia', color: '#3b82f6' };

  it('ordena de mayor a menor y reparte el porcentaje sobre el total del rango', () => {
    const rows = categoryBreakdown([
      session({ y: 2026, m: 8, d: 22 }, 30, { category: historia }),
      session({ y: 2026, m: 8, d: 21 }, 50, { category: calculo }),
      session({ y: 2026, m: 8, d: 20 }, 20, { category: calculo }),
    ]);

    expect(rows.map((r) => [r.name, r.minutes])).toEqual([
      ['Cálculo', 70],
      ['Historia', 30],
    ]);
    expect(rows.map((r) => Math.round(r.share))).toEqual([70, 30]);
  });

  it('agrupa el tiempo sin categoría en su propia fila, a diferencia de categoryTotals', () => {
    const sessions = [
      session({ y: 2026, m: 8, d: 22 }, 60, { category: calculo }),
      session({ y: 2026, m: 8, d: 22 }, 40),
    ];

    expect(categoryTotals(sessions)).toHaveLength(1);

    const rows = categoryBreakdown(sessions);
    expect(rows.map((r) => [r.name, r.minutes])).toEqual([
      ['Cálculo', 60],
      ['Sin categoría', 40],
    ]);
    // Si el hueco se descartara, la columna sumaría 100 % de una cifra que no
    // coincide con el tiempo realmente estudiado.
    expect(rows.reduce((acc, r) => acc + r.share, 0)).toBeCloseTo(100);
  });

  it('respeta el filtro `from`', () => {
    const rows = categoryBreakdown(
      [
        session({ y: 2026, m: 8, d: 22 }, 30, { category: calculo }),
        session({ y: 2026, m: 7, d: 10 }, 90, { category: calculo }),
      ],
      new Date(2026, 7, 1)
    );
    expect(rows).toEqual([{ name: 'Cálculo', color: '#67b31f', minutes: 30, share: 100 }]);
  });

  it('calcula el porcentaje sobre segundos, no sobre los minutos ya redondeados', () => {
    // 90 s y 30 s: en minutos redondeados serían 2 y 1 (67 %/33 %), pero el
    // reparto real es 75 %/25 %.
    const rows = categoryBreakdown([
      session({ y: 2026, m: 8, d: 22 }, 1.5, { category: calculo }),
      session({ y: 2026, m: 8, d: 22 }, 0.5, { category: historia }),
    ]);
    expect(rows.map((r) => Math.round(r.share))).toEqual([75, 25]);
  });

  it('descarta las filas que redondean a cero minutos', () => {
    const rows = categoryBreakdown([
      session({ y: 2026, m: 8, d: 22 }, 0.2, { category: calculo }),
    ]);
    expect(rows).toEqual([]);
  });

  it('sin sesiones en el rango devuelve una tabla vacía, no filas en cero', () => {
    expect(categoryBreakdown([], new Date(2026, 7, 1))).toEqual([]);
  });
});

describe('comparePeriods', () => {
  // Miércoles 19 de agosto de 2026, 12:00. La semana en curso lleva dos días
  // y medio; la anterior tuvo siete.
  const now = new Date(2026, 7, 19, 12, 0);

  it('recorta el periodo anterior al mismo avance, no lo compara entero', () => {
    const sessions = [
      // Semana en curso: lunes 17 y martes 18.
      session({ y: 2026, m: 8, d: 17, h: 9 }, 60),
      session({ y: 2026, m: 8, d: 18, h: 9 }, 60),
      // Semana anterior: lunes 10 (dentro del tramo comparable) y sábado 15
      // (fuera: la semana en curso todavía no ha llegado al sábado).
      session({ y: 2026, m: 8, d: 10, h: 9 }, 30),
      session({ y: 2026, m: 8, d: 15, h: 9 }, 600),
    ];

    const result = comparePeriods(sessions, 'week', now);
    expect(result.current).toBe(120);
    // Solo los 30 min del lunes: el sábado de la semana pasada queda fuera del
    // tramo. Sin el recorte, el sábado hundiría la comparación un −80 %.
    expect(result.previous).toBe(30);
    expect(Math.round(result.deltaPct!)).toBe(300);
  });

  it('deja el porcentaje en null si el periodo anterior estuvo en cero', () => {
    const result = comparePeriods([session({ y: 2026, m: 8, d: 19, h: 9 }, 45)], 'day', now);
    expect(result.current).toBe(45);
    expect(result.previous).toBe(0);
    expect(result.deltaPct).toBeNull();
  });

  it('el mes anterior no se solapa con el actual aunque sea más corto', () => {
    // 2 de marzo: el tramo comparable de febrero acabaría el 2 de marzo si no
    // se topara en el inicio del mes actual.
    const marchSecond = new Date(2026, 2, 2, 12, 0);
    const sessions = [
      session({ y: 2026, m: 3, d: 1, h: 9 }, 20),
      session({ y: 2026, m: 2, d: 1, h: 9 }, 50),
    ];
    const result = comparePeriods(sessions, 'month', marchSecond);
    expect(result.current).toBe(20);
    expect(result.previous).toBe(50);
  });
});

describe('hourBlocks / bestHourBlock', () => {
  const evening = (d: number, minutes: number) =>
    session({ y: 2026, m: 8, d, h: 19, min: 30 }, minutes);

  it('agrupa por la hora local de inicio en bloques de 3 h', () => {
    const blocks = hourBlocks([evening(10, 60), session({ y: 2026, m: 8, d: 11, h: 7 }, 30)]);
    expect(blocks).toHaveLength(8);
    expect(blocks.find((b) => b.startHour === 18)).toMatchObject({
      label: '18:00–21:00',
      minutes: 60,
    });
    expect(blocks.find((b) => b.startHour === 6)?.minutes).toBe(30);
  });

  it('no proclama una franja favorita con muy pocas sesiones', () => {
    expect(bestHourBlock([evening(10, 60), evening(11, 60)])).toBeNull();
  });

  it('con suficientes sesiones devuelve el bloque de más tiempo', () => {
    const sessions = [
      evening(10, 60),
      evening(11, 60),
      evening(12, 60),
      evening(13, 60),
      session({ y: 2026, m: 8, d: 14, h: 7 }, 30),
    ];
    expect(bestHourBlock(sessions)?.startHour).toBe(18);
  });
});

describe('focusTotals', () => {
  const rated = (d: number, minutes: number, rating: 'focused' | 'ok' | 'distracted') => ({
    ...session({ y: 2026, m: 8, d }, minutes),
    focus_rating: rating,
  });

  it('reparte sobre el tiempo calificado e ignora el resto', () => {
    const { totals, ratedMinutes, ratedSessions } = focusTotals([
      rated(10, 60, 'focused'),
      rated(11, 20, 'distracted'),
      // Sin calificar: no entra en el reparto. Si contara, cualquier
      // porcentaje se iría hacia «sin datos», que es casi todo el histórico.
      session({ y: 2026, m: 8, d: 12 }, 300),
    ]);

    expect(ratedSessions).toBe(2);
    expect(ratedMinutes).toBe(80);
    expect(totals.map((t) => [t.rating, t.minutes, Math.round(t.share)])).toEqual([
      ['focused', 60, 75],
      ['ok', 0, 0],
      ['distracted', 20, 25],
    ]);
  });

  it('sin nada calificado devuelve las tres filas en cero', () => {
    const { totals, ratedSessions } = focusTotals([session({ y: 2026, m: 8, d: 10 }, 60)]);
    expect(ratedSessions).toBe(0);
    expect(totals.every((t) => t.minutes === 0 && t.share === 0)).toBe(true);
  });
});

describe('heatmapWeeks / heatmapLevel', () => {
  // Miércoles 19 de agosto de 2026.
  const now = new Date(2026, 7, 19, 12, 0);

  it('devuelve semanas completas de lunes a domingo', () => {
    const weeks = heatmapWeeks([], 4, now);
    expect(weeks).toHaveLength(4);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    // La última columna es la semana en curso, que empieza el lunes 17.
    expect(weeks[3][0].key).toBe('2026-08-17');
    expect(weeks[3][6].key).toBe('2026-08-23');
  });

  it('marca como futuros los días de esta semana que aún no han llegado', () => {
    const weeks = heatmapWeeks([], 2, now);
    const thisWeek = weeks[1];
    // Lunes a miércoles ya pasaron; de jueves en adelante, no.
    expect(thisWeek.slice(0, 3).some((d) => d.isFuture)).toBe(false);
    expect(thisWeek.slice(3).every((d) => d.isFuture)).toBe(true);
  });

  it('agrupa los minutos por día local, no por día UTC', () => {
    // 19:30 en UTC−5 son las 00:30 UTC del día siguiente.
    const weeks = heatmapWeeks([session({ y: 2026, m: 8, d: 18, h: 19, min: 30 }, 45)], 2, now);
    const day = weeks.flat().find((d) => d.key === '2026-08-18');
    expect(day?.minutes).toBe(45);
  });

  it('reparte la intensidad en cuartiles del máximo del periodo', () => {
    expect(heatmapLevel(0, 100)).toBe(0);
    expect(heatmapLevel(1, 100)).toBe(1);
    expect(heatmapLevel(25, 100)).toBe(1);
    expect(heatmapLevel(50, 100)).toBe(2);
    expect(heatmapLevel(75, 100)).toBe(3);
    expect(heatmapLevel(100, 100)).toBe(4);
  });

  it('sin máximo no enciende ninguna celda', () => {
    expect(heatmapLevel(0, 0)).toBe(0);
  });
});

describe('heatmapWeekSpan', () => {
  // Domingo 23 de agosto de 2026; el lunes de su semana es el 17.
  const now = new Date(2026, 7, 23, 12, 0);

  it('arranca en la semana de la primera sesión, no un año atrás', () => {
    // Primera sesión: miércoles 8 de julio de 2026 → lunes 6 de julio.
    // Del 6 de julio al 17 de agosto hay 6 semanas de diferencia; con la
    // actual incluida, 7 columnas.
    const span = heatmapWeekSpan([session({ y: 2026, m: 7, d: 8 }, 30)], now);
    expect(span).toBe(7);

    const weeks = heatmapWeeks([], span, now);
    expect(weeks[0][0].key).toBe('2026-07-06');
    expect(weeks[span - 1][0].key).toBe('2026-08-17');
  });

  it('no pasa del techo aunque el historial sea más antiguo', () => {
    const span = heatmapWeekSpan([session({ y: 2020, m: 1, d: 6 }, 30)], now, 53);
    expect(span).toBe(53);
  });

  it('una sola sesión de esta semana da una única columna', () => {
    expect(heatmapWeekSpan([session({ y: 2026, m: 8, d: 19 }, 30)], now)).toBe(1);
  });

  it('sin sesiones no calcula un rango vacío negativo', () => {
    expect(heatmapWeekSpan([], now)).toBe(1);
  });
});
