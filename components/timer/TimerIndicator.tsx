'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Coffee, Pause, PictureInPicture2, Play, SkipForward, Square, X } from 'lucide-react';
import { formatDuration } from '@/lib/utils';
import { useTimer } from './TimerProvider';

const iconButton =
  'flex items-center justify-center w-8 h-8 rounded-lg text-[var(--color-text-soft)] hover:bg-[var(--color-gray-light)] hover:text-[var(--color-text)] transition-colors';

const textButton =
  'flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap';

/**
 * Reloj compacto para las páginas distintas de /timer.
 *
 * El temporizador sigue corriendo al navegar (vive en `TimerProvider`), así
 * que hace falta verlo y controlarlo desde cualquier sitio: si no, el usuario
 * no sabría que hay una sesión en marcha ni podría decidir qué hacer al
 * terminar un bloque Pomodoro sin volver a /timer.
 */
export function TimerIndicator() {
  const pathname = usePathname();
  const {
    state,
    secondsLeft,
    phaseLabel,
    awaitingBreak,
    awaitingFocus,
    startLabel,
    pipOpen,
    openPiP,
    start,
    pause,
    resume,
    stop,
    skipBreak,
  } = useTimer();

  const active = state.isRunning || awaitingBreak || awaitingFocus;
  if (!active || pathname.startsWith('/timer')) return null;

  const isRest = state.mode === 'pomodoro' && state.phase !== 'focus';

  return (
    <div
      role="region"
      aria-label="Temporizador en curso"
      className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-2xl border border-[var(--color-gray-border)] bg-[var(--color-surface)] py-2 pl-3 pr-2 shadow-[var(--shadow-card)] md:left-6"
    >
      <Link
        href="/timer"
        title="Abrir Tiempo de estudio"
        className="flex items-center gap-2.5 min-w-0 rounded-lg pr-1"
      >
        <span
          aria-hidden
          className={`w-2 h-2 flex-shrink-0 rounded-full ${
            isRest ? 'bg-[var(--color-gray-mid)]' : 'bg-[var(--color-primary)]'
          } ${state.isRunning && !state.isPaused ? 'animate-pulse' : ''}`}
        />
        <span className="flex flex-col leading-tight">
          <span className="text-[11px] font-medium text-[var(--color-text-soft)] truncate">
            {awaitingBreak ? 'Bloque completado' : state.isPaused ? `${phaseLabel} · en pausa` : phaseLabel}
          </span>
          <span className="text-lg font-bold tabular-nums text-[var(--color-text)]">
            {formatDuration(secondsLeft)}
          </span>
        </span>
      </Link>

      <div className="flex items-center gap-1">
        {state.isRunning ? (
          <>
            {state.isPaused ? (
              <button onClick={resume} aria-label="Reanudar" title="Reanudar" className={iconButton}>
                <Play size={16} />
              </button>
            ) : (
              <button onClick={pause} aria-label="Pausar" title="Pausar" className={iconButton}>
                <Pause size={16} />
              </button>
            )}
            <button
              onClick={stop}
              aria-label="Detener"
              title="Detener"
              className={`${iconButton} hover:!text-red-600 dark:hover:!text-red-400`}
            >
              <Square size={15} />
            </button>
            {!pipOpen && (
              <button
                onClick={openPiP}
                aria-label="Ventana flotante"
                title="Ventana flotante"
                className={iconButton}
              >
                <PictureInPicture2 size={16} />
              </button>
            )}
          </>
        ) : awaitingBreak ? (
          <>
            <button
              onClick={start}
              className={`${textButton} bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]`}
            >
              <Coffee size={14} />
              Descansar
            </button>
            <button
              onClick={skipBreak}
              className={`${textButton} border border-[var(--color-gray-border)] text-[var(--color-text-soft)] hover:bg-[var(--color-gray-light)]`}
            >
              <SkipForward size={14} />
              Siguiente bloque
            </button>
          </>
        ) : (
          <>
            <button
              onClick={start}
              className={`${textButton} bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]`}
            >
              <Play size={14} />
              {startLabel}
            </button>
            <button
              onClick={stop}
              aria-label="Terminar la tanda"
              title="Terminar la tanda"
              className={iconButton}
            >
              <X size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
