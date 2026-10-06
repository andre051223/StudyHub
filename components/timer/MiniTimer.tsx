'use client';

import { formatDuration } from '@/lib/utils';

interface Props {
  secondsLeft: number;
  phaseLabel: string;
  isRunning: boolean;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onStart: () => void;
  /** Texto del botón de arranque (p. ej. "Iniciar descanso" en el Pomodoro). */
  startLabel?: string;
  /** Acción secundaria con el reloj parado: saltar el descanso del Pomodoro. */
  onSkip?: () => void;
  skipLabel?: string;
}

const PRIMARY = '#67b31f';
const DANGER = '#dc2626';

const buttonBase: React.CSSProperties = {
  padding: '2vmin 5vmin',
  borderRadius: '2vmin',
  fontSize: 'clamp(10px, 5vw, 16px)',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'all 0.15s ease',
};

// Los colores se leen de variables CSS inyectadas en la ventana PiP
// (ver TimerClient.openPiP), con fallback al tema claro. Así la ventana
// flotante respeta el modo oscuro y el contenido escala con su tamaño.
export function MiniTimer({
  secondsLeft,
  phaseLabel,
  isRunning,
  isPaused,
  onPause,
  onResume,
  onStop,
  onStart,
  startLabel = 'Iniciar',
  onSkip,
  skipLabel = 'Saltar',
}: Props) {
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
        padding: '5vmin 6vmin',
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
          fontSize: 'clamp(28px, 16vw, 88px)',
          fontWeight: 700,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatDuration(secondsLeft)}
      </span>
      <div style={{ display: 'flex', gap: '2vmin', marginTop: '2vmin' }}>
        {isRunning ? (
          <>
            <button
              onClick={isPaused ? onResume : onPause}
              style={{
                ...buttonBase,
                background: isPaused ? PRIMARY : 'transparent',
                border: `1.5px solid ${isPaused ? PRIMARY : 'var(--color-gray-border, #e2e8f0)'}`,
                color: isPaused ? '#ffffff' : 'var(--color-text-soft, #444444)',
              }}
            >
              {isPaused ? 'Reanudar' : 'Pausar'}
            </button>
            <button
              onClick={onStop}
              style={{
                ...buttonBase,
                background: 'transparent',
                border: `1.5px solid ${DANGER}`,
                color: DANGER,
              }}
            >
              Detener
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onStart}
              style={{
                ...buttonBase,
                background: PRIMARY,
                border: `1.5px solid ${PRIMARY}`,
                color: '#ffffff',
              }}
            >
              {startLabel}
            </button>
            {onSkip && (
              <button
                onClick={onSkip}
                style={{
                  ...buttonBase,
                  background: 'transparent',
                  border: '1.5px solid var(--color-gray-border, #e2e8f0)',
                  color: 'var(--color-text-soft, #444444)',
                }}
              >
                {skipLabel}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
