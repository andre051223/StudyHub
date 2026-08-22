import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  // El cronómetro puede superar la hora; en ese caso muestra HH:MM:SS.
  if (h > 0) return `${h.toString().padStart(2, '0')}:${m}:${s}`;
  return `${m}:${s}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getCircumference(radius: number): number {
  return 2 * Math.PI * radius;
}

/**
 * Las fechas límite de las tareas se leen en UTC, no en local: ver la nota de
 * `lib/deadlines.ts`. Sus helpers viven allí en lugar de aquí para que no se
 * confundan con `formatDate()`, que sí formatea instantes reales.
 */
