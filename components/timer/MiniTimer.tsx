'use client';

import { formatDuration } from '@/lib/utils';

interface Props {
  secondsLeft: number;
  phaseLabel: string;
  isRunning: boolean;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
}

const PRIMARY = '#67b31f';

// Los colores se leen de variables CSS inyectadas en la ventana PiP
// (ver TimerClient.openPiP), con fallback al tema claro. Así la ventana
// flotante respeta el modo oscuro y el contenido escala con su tamaño.
export function MiniTimer({ secondsLeft, phaseLabel, isRunning, isPaused, onPause, onResume }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        width: '100%',
        height: '100%',
        background: 'var(--color-surface, #ffffff)',
        color: 'var(--color-text, #1a1a1a)',
        fontFamily: 'system-ui, sans-serif',
        gap: '2vmin',
        userSelect: 'none',
        padding: '6vmin 8vmin',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          fontSize: 'clamp(8px, 5vw, 16px)',
          fontWeight: 600,
          color: PRIMARY,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          textAlign: 'center',
          lineHeight: 1.1,
        }}
      >
        {phaseLabel}
      </span>
      <span
        style={{
          fontSize: 'clamp(28px, 18vw, 96px)',
          fontWeight: 700,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatDuration(secondsLeft)}
      </span>
      {isRunning && (
        <button
          onClick={isPaused ? onResume : onPause}
          style={{
            marginTop: '2vmin',
            padding: '2vmin 6vmin',
            background: isPaused ? PRIMARY : 'transparent',
            border: `1.5px solid ${isPaused ? PRIMARY : 'var(--color-gray-border, #e2e8f0)'}`,
            color: isPaused ? '#ffffff' : 'var(--color-text-soft, #444444)',
            borderRadius: '2vmin',
            fontSize: 'clamp(10px, 5vw, 18px)',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease',
          }}
        >
          {isPaused ? 'Reanudar' : 'Pausar'}
        </button>
      )}
    </div>
  );
}
