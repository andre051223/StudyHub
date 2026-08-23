/**
 * Cálculo de estadísticas de estudio.
 *
 * Antes de este módulo había cuatro implementaciones distintas de las mismas
 * métricas (dashboard, StudyStats, StudyGoals y SessionModel), y ninguna
 * coincidía con las otras. Las diferencias no eran de estilo:
 *
 * 1. Tres de las cuatro sumaban `duration_minutes`, que es la duración
 *    *planeada* de la sesión. Si eliges 60 minutos y detienes a los tres, esa
 *    versión suma 60. Aquí siempre se usa `actual_duration_seconds`, que es lo
 *    que realmente se estudió.
 *
 * 2. Todas agrupaban los días con `started_at.slice(0, 10)`, que extrae la
 *    fecha **UTC** del timestamp. En UTC−5 una sesión de las 19:30 se
 *    contabilizaba como del día siguiente: la gráfica diaria desplazaba el
 *    estudio nocturno, la meta diaria no se marcaba cumplida y la racha se
 *    rompía sola. `localDayKey()` agrupa por el día natural del usuario.
 *
 * Las funciones son puras y reciben `now` por parámetro para poder probarlas
 * con una fecha fija (ver `lib/stats.test.ts`).
 */

/**
 * Forma mínima que necesitan los cálculos. Es un supertipo de `StudySession`,
 * así que cualquier consulta que traiga estas columnas sirve — no hace falta
 * seleccionar la fila completa solo para calcular estadísticas.
 */
export interface StatsSession {
  /**
   * Opcional porque los cálculos no lo necesitan, pero la pantalla del
   * temporizador sí: sin él no hay forma de reflejar en las estadísticas ya
   * cargadas la sesión que se acaba de corregir o eliminar.
   */
  id?: string;
  started_at: string;
  actual_duration_seconds: number;
  completed_at: string | null;
  category_id?: string | null;
  category?: { name: string; color: string } | { name: string; color: string }[] | null;
  /** Calidad percibida (migración 009). Opcional: el histórico no la tiene. */
  focus_rating?: 'focused' | 'ok' | 'distracted' | null;
}

export interface DailyBucket {
  /** Clave local `YYYY-MM-DD`. */
  key: string;
  /** Fecha local del bucket, útil para formatear la etiqueta del eje. */
  date: Date;
  minutes: number;
}

export interface CategoryTotal {
  name: string;
  color: string;
  minutes: number;
}

/**
 * Clave de día (`YYYY-MM-DD`) en la **zona horaria local** del usuario.
 *
 * No usar `toISOString().slice(0, 10)` para esto: convierte a UTC primero y
 * desplaza el día en cualquier zona con offset distinto de cero.
 */
export function localDayKey(value: string | number | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Medianoche local del día al que pertenece `value`. */
export function startOfLocalDay(value: string | number | Date): Date {
  const d = value instanceof Date ? new Date(value) : new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Medianoche local del lunes de la semana de `value`. */
export function startOfLocalWeek(value: string | number | Date): Date {
  const d = startOfLocalDay(value);
  // getDay(): 0 = domingo. Queremos que la semana empiece en lunes.
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}

/** Solo las sesiones que llegaron a completarse; las abandonadas no cuentan. */
export function onlyCompleted<T extends StatsSession>(sessions: T[]): T[] {
  return sessions.filter((s) => s.completed_at !== null);
}

/**
 * Suma de segundos realmente estudiados. Se redondea una sola vez al final,
 * al convertir a minutos, para no acumular el error de redondear cada sesión.
 */
function totalSeconds(sessions: StatsSession[]): number {
  return sessions.reduce((acc, s) => acc + (s.actual_duration_seconds ?? 0), 0);
}

function toMinutes(seconds: number): number {
  return Math.round(seconds / 60);
}

/** Minutos estudiados desde `from` (inclusive) hasta ahora. */
export function minutesSince(sessions: StatsSession[], from: Date): number {
  const fromMs = from.getTime();
  return toMinutes(
    totalSeconds(sessions.filter((s) => new Date(s.started_at).getTime() >= fromMs))
  );
}

/** Minutos estudiados en el día natural (local) de `day`. */
export function minutesOnDay(sessions: StatsSession[], day: Date | string): number {
  const key = localDayKey(day);
  return toMinutes(totalSeconds(sessions.filter((s) => localDayKey(s.started_at) === key)));
}

/** Minutos de los últimos 7 días naturales, incluido hoy. */
export function minutesThisWeek(sessions: StatsSession[], now: Date = new Date()): number {
  const from = startOfLocalDay(now);
  from.setDate(from.getDate() - 6);
  return minutesSince(sessions, from);
}

/** Minutos desde el lunes de la semana en curso. */
export function minutesSinceMonday(sessions: StatsSession[], now: Date = new Date()): number {
  return minutesSince(sessions, startOfLocalWeek(now));
}

/**
 * Un bucket por día natural para los últimos `days` días, en orden
 * cronológico y con ceros incluidos (los huecos son información en una
 * gráfica de barras).
 */
export function dailyBuckets(
  sessions: StatsSession[],
  days = 7,
  now: Date = new Date()
): DailyBucket[] {
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    const key = localDayKey(s.started_at);
    byDay.set(key, (byDay.get(key) ?? 0) + (s.actual_duration_seconds ?? 0));
  }

  const today = startOfLocalDay(now);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (days - 1 - i));
    const key = localDayKey(date);
    return { key, date, minutes: toMinutes(byDay.get(key) ?? 0) };
  });
}

/**
 * Días naturales consecutivos con al menos una sesión completada.
 *
 * La racha sigue viva si la última sesión fue hoy **o** ayer — de lo contrario
 * empezar el día sin haber estudiado todavía la pondría a cero.
 */
export function currentStreak(sessions: StatsSession[], now: Date = new Date()): number {
  if (sessions.length === 0) return 0;

  const days = new Set(sessions.map((s) => localDayKey(s.started_at)));
  const cursor = startOfLocalDay(now);

  if (!days.has(localDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(localDayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(localDayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Promedio diario de los últimos `days` días naturales, dividiendo entre los
 * días transcurridos y no entre los días con sesión: un promedio que ignora
 * los días en blanco no es un promedio.
 */
export function dailyAverage(
  sessions: StatsSession[],
  days = 7,
  now: Date = new Date()
): number {
  if (days <= 0) return 0;
  const from = startOfLocalDay(now);
  from.setDate(from.getDate() - (days - 1));
  return Math.round(
    totalSeconds(sessions.filter((s) => new Date(s.started_at).getTime() >= from.getTime())) /
      60 /
      days
  );
}

/** Supabase devuelve las relaciones incrustadas como objeto o como array. */
function categoryOf(s: StatsSession): { name: string; color: string } | null {
  const c = s.category;
  if (!c) return null;
  return Array.isArray(c) ? c[0] ?? null : c;
}

/** Minutos por categoría desde `from`, de mayor a menor. */
export function categoryTotals(sessions: StatsSession[], from?: Date): CategoryTotal[] {
  const fromMs = from?.getTime();
  const totals = new Map<string, CategoryTotal>();

  for (const s of sessions) {
    if (fromMs !== undefined && new Date(s.started_at).getTime() < fromMs) continue;
    const category = categoryOf(s);
    if (!category) continue;

    const existing = totals.get(category.name);
    if (existing) {
      existing.minutes += s.actual_duration_seconds ?? 0;
    } else {
      totals.set(category.name, {
        name: category.name,
        color: category.color,
        minutes: s.actual_duration_seconds ?? 0,
      });
    }
  }

  return [...totals.values()]
    .map((c) => ({ ...c, minutes: toMinutes(c.minutes) }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Primer día del mes en curso, en hora local. */
export function startOfLocalMonth(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Ventana temporal del desglose por categoría.
 *
 * `week` arranca el lunes y `month` el día 1 — no son «los últimos 7/30 días».
 * Es a propósito: el usuario compara contra la semana y el mes que está
 * viviendo, que es también el rango con el que se miden las metas
 * (`minutesSinceMonday`). Un rango deslizante daría, para el mismo día, un
 * total distinto al que muestra la meta semanal.
 */
export type StatsRange = 'day' | 'week' | 'month';

/** Inicio (inclusive) del rango, en hora local. */
export function rangeStart(range: StatsRange, now: Date = new Date()): Date {
  switch (range) {
    case 'day':
      return startOfLocalDay(now);
    case 'week':
      return startOfLocalWeek(now);
    case 'month':
      return startOfLocalMonth(now);
  }
}

/** Etiqueta corta de cada rango, para los filtros y los estados vacíos. */
export const RANGE_LABELS: Record<StatsRange, string> = {
  day: 'Hoy',
  week: 'Esta semana',
  month: 'Este mes',
};

/** Nombre con el que se agrupan las sesiones sin categoría asignada. */
export const UNCATEGORIZED_LABEL = 'Sin categoría';

/** Gris neutro para la fila «Sin categoría»: no es una categoría real. */
const UNCATEGORIZED_COLOR = '#9aa3b2';

export interface CategoryShare extends CategoryTotal {
  /** Porcentaje del tiempo total del rango, 0–100. */
  share: number;
}

/**
 * Desglose por categoría dentro de un rango, de mayor a menor.
 *
 * Se diferencia de `categoryTotals` en dos cosas, ambas necesarias para
 * presentar una tabla y no una gráfica:
 *
 *  · Incluye una fila «Sin categoría» con el tiempo suelto. `categoryTotals`
 *    lo descarta porque solo necesita saber cuál es la categoría más
 *    estudiada, pero en una tabla con porcentajes ese hueco haría que la
 *    columna no sumara 100 % y que el total no cuadrara con el resto.
 *
 *  · El porcentaje se calcula sobre los **segundos**, no sobre los minutos ya
 *    redondeados, para que la columna no se desvíe del 100 % acumulando el
 *    error de redondeo de cada fila.
 */
export function categoryBreakdown(
  sessions: StatsSession[],
  from?: Date
): CategoryShare[] {
  const fromMs = from?.getTime();
  const byName = new Map<string, { color: string; seconds: number }>();
  let totalInRange = 0;

  for (const s of sessions) {
    if (fromMs !== undefined && new Date(s.started_at).getTime() < fromMs) continue;

    const category = categoryOf(s);
    const name = category?.name ?? UNCATEGORIZED_LABEL;
    const color = category?.color ?? UNCATEGORIZED_COLOR;
    const value = s.actual_duration_seconds ?? 0;

    const existing = byName.get(name);
    if (existing) existing.seconds += value;
    else byName.set(name, { color, seconds: value });

    totalInRange += value;
  }

  return [...byName.entries()]
    .map(([name, { color, seconds }]) => ({
      name,
      color,
      minutes: toMinutes(seconds),
      share: totalInRange > 0 ? (seconds / totalInRange) * 100 : 0,
    }))
    // Una sesión de menos de 30 s redondea a 0 min; mostrarla como «0,0 h»
    // solo añadiría ruido a la tabla.
    .filter((row) => row.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name, 'es'));
}

export interface StudySummary {
  /** Minutos de los últimos 7 días naturales. */
  minutesThisWeek: number;
  /** Minutos desde el lunes de esta semana (el que compara con la meta semanal). */
  minutesSinceMonday: number;
  minutesToday: number;
  currentStreak: number;
  dailyAverage: number;
  topCategoryThisMonth: string | null;
}

/**
 * Resumen completo a partir de una lista de sesiones. Filtra las abandonadas
 * por su cuenta, así que se le puede pasar el historial sin preparar.
 */
export function summarize(sessions: StatsSession[], now: Date = new Date()): StudySummary {
  const completed = onlyCompleted(sessions);
  const month = categoryTotals(completed, startOfLocalMonth(now));

  return {
    minutesThisWeek: minutesThisWeek(completed, now),
    minutesSinceMonday: minutesSinceMonday(completed, now),
    minutesToday: minutesOnDay(completed, now),
    currentStreak: currentStreak(completed, now),
    dailyAverage: dailyAverage(completed, 7, now),
    topCategoryThisMonth: month[0]?.name ?? null,
  };
}

// ─────────────────────────────────────────────────────────────
// Comparación contra el periodo anterior
// ─────────────────────────────────────────────────────────────

/** Minutos estudiados en el intervalo `[from, to)`. */
export function minutesBetween(sessions: StatsSession[], from: Date, to: Date): number {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  return toMinutes(
    totalSeconds(
      sessions.filter((s) => {
        const t = new Date(s.started_at).getTime();
        return t >= fromMs && t < toMs;
      })
    )
  );
}

/** Inicio del periodo inmediatamente anterior al de `range`. */
export function previousRangeStart(range: StatsRange, now: Date = new Date()): Date {
  const start = rangeStart(range, now);
  switch (range) {
    case 'day': {
      const d = new Date(start);
      d.setDate(d.getDate() - 1);
      return d;
    }
    case 'week': {
      const d = new Date(start);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case 'month':
      return new Date(start.getFullYear(), start.getMonth() - 1, 1);
  }
}

export interface PeriodComparison {
  /** Minutos en lo que va del periodo actual. */
  current: number;
  /** Minutos en el mismo tramo del periodo anterior. */
  previous: number;
  /** Variación porcentual, o null si el periodo anterior estuvo en cero. */
  deltaPct: number | null;
}

/**
 * Compara el periodo en curso con el anterior **al mismo punto de avance**.
 *
 * Es la parte que hay que hacer bien: un martes, la semana en curso lleva dos
 * días y la anterior tuvo siete. Enfrentarlas enteras daría siempre un −70 %
 * que no significa nada y que solo se pondría en verde los domingos por la
 * noche. Aquí el periodo anterior se recorta al mismo tiempo transcurrido, así
 * que la pregunta que responde es «¿voy mejor que a estas alturas de la semana
 * pasada?».
 *
 * El recorte se topa en el inicio del periodo actual para que un mes anterior
 * más corto (febrero) no se solape con el actual.
 */
export function comparePeriods(
  sessions: StatsSession[],
  range: StatsRange,
  now: Date = new Date()
): PeriodComparison {
  const from = rangeStart(range, now);
  const prevFrom = previousRangeStart(range, now);
  const elapsedMs = Math.max(0, now.getTime() - from.getTime());
  const prevTo = new Date(Math.min(prevFrom.getTime() + elapsedMs, from.getTime()));

  const current = minutesBetween(sessions, from, now);
  const previous = minutesBetween(sessions, prevFrom, prevTo);

  return {
    current,
    previous,
    deltaPct: previous > 0 ? ((current - previous) / previous) * 100 : null,
  };
}

// ─────────────────────────────────────────────────────────────
// Franja horaria
// ─────────────────────────────────────────────────────────────

/** Ancho de los bloques horarios, en horas. Ocho bloques cubren el día. */
const HOUR_BLOCK_SIZE = 3;

export interface HourBlock {
  /** Hora local de inicio del bloque (0, 3, 6, …). */
  startHour: number;
  endHour: number;
  /** `"18:00–21:00"`. */
  label: string;
  minutes: number;
}

function padHour(h: number): string {
  return `${String(h % 24).padStart(2, '0')}:00`;
}

/**
 * Minutos estudiados por bloque de 3 h, en orden cronológico y con ceros.
 *
 * Se agrupa por la hora de **inicio** de la sesión. Una que cruce el límite del
 * bloque cuenta entera en el suyo: repartirla exigiría conocer las pausas, y el
 * dato que interesa —a qué hora te sientas a estudiar— es el de arranque.
 *
 * Bloques de 3 h y no de 1 h porque con una hora de granularidad el máximo lo
 * decide el ruido: dos sesiones sueltas a las 03:00 bastarían para coronar esa
 * hora como «tu mejor franja».
 */
export function hourBlocks(sessions: StatsSession[], from?: Date): HourBlock[] {
  const fromMs = from?.getTime();
  const blocks = Array.from({ length: 24 / HOUR_BLOCK_SIZE }, (_, i) => ({
    startHour: i * HOUR_BLOCK_SIZE,
    endHour: (i + 1) * HOUR_BLOCK_SIZE,
    label: `${padHour(i * HOUR_BLOCK_SIZE)}–${padHour((i + 1) * HOUR_BLOCK_SIZE)}`,
    seconds: 0,
  }));

  for (const s of sessions) {
    const started = new Date(s.started_at);
    if (fromMs !== undefined && started.getTime() < fromMs) continue;
    const index = Math.floor(started.getHours() / HOUR_BLOCK_SIZE);
    blocks[index].seconds += s.actual_duration_seconds ?? 0;
  }

  return blocks.map(({ seconds, ...rest }) => ({ ...rest, minutes: toMinutes(seconds) }));
}

/**
 * Bloque con más tiempo acumulado, o null si no hay nada que destacar.
 *
 * Exige un mínimo de sesiones para no proclamar «tu mejor franja» a partir de
 * la única que existe, que es la trampa clásica de este tipo de conclusión.
 */
export function bestHourBlock(
  sessions: StatsSession[],
  from?: Date,
  minSessions = 5
): HourBlock | null {
  const fromMs = from?.getTime();
  const inRange = sessions.filter(
    (s) => fromMs === undefined || new Date(s.started_at).getTime() >= fromMs
  );
  if (inRange.length < minSessions) return null;

  const best = hourBlocks(inRange).reduce((a, b) => (b.minutes > a.minutes ? b : a));
  return best.minutes > 0 ? best : null;
}

// ─────────────────────────────────────────────────────────────
// Calidad percibida de las sesiones
// ─────────────────────────────────────────────────────────────

export type FocusRatingKey = 'focused' | 'ok' | 'distracted';

/** Orden de mejor a peor; también el orden en que se pintan. */
export const FOCUS_RATINGS: FocusRatingKey[] = ['focused', 'ok', 'distracted'];

export interface FocusTotal {
  rating: FocusRatingKey;
  sessions: number;
  minutes: number;
  /** Porcentaje sobre el tiempo **calificado**, no sobre el total del rango. */
  share: number;
}

/**
 * Reparto del tiempo calificado entre las tres respuestas posibles.
 *
 * Las sesiones sin calificar se excluyen del cálculo en vez de contarse como
 * una cuarta categoría: son la mayoría del histórico —la columna es nueva— y
 * arrastrarían cualquier porcentaje hacia «sin datos». Los totales de lo
 * calificado salen aparte para que la interfaz pueda decir sobre cuánto se
 * está opinando.
 */
export function focusTotals(
  sessions: StatsSession[],
  from?: Date
): { totals: FocusTotal[]; ratedMinutes: number; ratedSessions: number } {
  const fromMs = from?.getTime();
  const seconds: Record<FocusRatingKey, number> = { focused: 0, ok: 0, distracted: 0 };
  const counts: Record<FocusRatingKey, number> = { focused: 0, ok: 0, distracted: 0 };
  let ratedSeconds = 0;
  let ratedSessions = 0;

  for (const s of sessions) {
    if (fromMs !== undefined && new Date(s.started_at).getTime() < fromMs) continue;
    const rating = s.focus_rating;
    if (!rating) continue;
    seconds[rating] += s.actual_duration_seconds ?? 0;
    counts[rating] += 1;
    ratedSeconds += s.actual_duration_seconds ?? 0;
    ratedSessions += 1;
  }

  return {
    totals: FOCUS_RATINGS.map((rating) => ({
      rating,
      sessions: counts[rating],
      minutes: toMinutes(seconds[rating]),
      share: ratedSeconds > 0 ? (seconds[rating] / ratedSeconds) * 100 : 0,
    })),
    ratedMinutes: toMinutes(ratedSeconds),
    ratedSessions,
  };
}

// ─────────────────────────────────────────────────────────────
// Mapa de calor anual
// ─────────────────────────────────────────────────────────────

export interface HeatmapDay extends DailyBucket {
  /**
   * True en los días de la semana en curso que aún no han llegado. La
   * cuadrícula siempre tiene semanas completas, así que hay que poder
   * distinguir «no estudiaste» de «todavía no ha pasado».
   */
  isFuture: boolean;
}

/**
 * Cuántas columnas cubren el historial real: de la semana de la primera
 * sesión a la actual, con un techo de `maxWeeks`.
 *
 * Fijar la ventana en 53 semanas hacía que una cuenta abierta en julio
 * arrancara la cuadrícula en el agosto anterior, con diez meses de celdas
 * grises de una época en la que ni existía la cuenta. Eso no es información
 * sobre la constancia: es ruido que empuja los datos reales al borde derecho.
 */
export function heatmapWeekSpan(
  sessions: StatsSession[],
  now: Date = new Date(),
  maxWeeks = 53
): number {
  if (sessions.length === 0) return 1;

  const firstStart = sessions.reduce(
    (min, s) => Math.min(min, new Date(s.started_at).getTime()),
    Number.POSITIVE_INFINITY
  );

  const firstMonday = startOfLocalWeek(firstStart);
  const currentMonday = startOfLocalWeek(now);
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  // `round` y no `floor`: entre dos medianoches locales puede haber una hora
  // de más o de menos en zonas con horario de verano, y un `floor` se comería
  // la primera columna justo en la semana del cambio.
  const weeks = Math.round((currentMonday.getTime() - firstMonday.getTime()) / weekMs) + 1;
  return Math.min(maxWeeks, Math.max(1, weeks));
}

/**
 * Cuadrícula del historial: una columna por semana, con el lunes arriba.
 *
 * La constancia es lo que la racha resume en un número y lo que la barra de
 * siete días no alcanza a mostrar. Devuelve semanas completas —incluida la
 * actual, con sus días futuros marcados— porque una rejilla con la última
 * columna a medias se lee como un hueco de estudio.
 */
export function heatmapWeeks(
  sessions: StatsSession[],
  weeks = 53,
  now: Date = new Date()
): HeatmapDay[][] {
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    const key = localDayKey(s.started_at);
    byDay.set(key, (byDay.get(key) ?? 0) + (s.actual_duration_seconds ?? 0));
  }

  const today = startOfLocalDay(now);
  // Lunes de la primera columna: se retrocede desde el lunes de esta semana.
  const firstMonday = startOfLocalWeek(today);
  firstMonday.setDate(firstMonday.getDate() - (weeks - 1) * 7);

  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(firstMonday);
      date.setDate(date.getDate() + w * 7 + d);
      const key = localDayKey(date);
      return {
        key,
        date,
        minutes: toMinutes(byDay.get(key) ?? 0),
        isFuture: date.getTime() > today.getTime(),
      };
    })
  );
}

/**
 * Intensidad 0–4 de una celda del mapa de calor.
 *
 * Los cortes son relativos al máximo del propio periodo y no absolutos: quien
 * estudia 30 min al día merece ver su constancia igual de encendida que quien
 * estudia cuatro horas. Un único día excepcional no apaga el resto, porque el
 * primer nivel se alcanza con cualquier minuto estudiado.
 */
export function heatmapLevel(minutes: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0 || max <= 0) return 0;
  const ratio = minutes / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/** `95` → `"1h 35m"`, `40` → `"40m"`. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
