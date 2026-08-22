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
  started_at: string;
  actual_duration_seconds: number;
  completed_at: string | null;
  category_id?: string | null;
  category?: { name: string; color: string } | { name: string; color: string }[] | null;
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

/** `95` → `"1h 35m"`, `40` → `"40m"`. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
