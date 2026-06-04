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
const PRIMARY_DARK = '#5a9e1b';

export function MiniTimer({ secondsLeft, phaseLabel, isRunning, isPaused, onPause, onResume }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        gap: 6,
        userSelect: 'none',
        padding: '16px 20px',
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: PRIMARY,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
        }}
      >
        {phaseLabel}
      </span>
      <span
        style={{
          fontSize: 52,
          fontWeight: 700,
          letterSpacing: 1,
          lineHeight: 1,
          color: '#1a1a1a',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatDuration(secondsLeft)}
      </span>
      {isRunning && (
        <button
          onClick={isPaused ? onResume : onPause}
          style={{
            marginTop: 10,
            padding: '7px 24px',
            background: isPaused ? PRIMARY : 'transparent',
            border: `1.5px solid ${isPaused ? PRIMARY : '#e2e8f0'}`,
            color: isPaused ? '#ffffff' : '#444444',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (!isPaused) {
              (e.currentTarget as HTMLButtonElement).style.background = '#f8f9fa';
            } else {
              (e.currentTarget as HTMLButtonElement).style.background = PRIMARY_DARK;
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = isPaused ? PRIMARY : 'transparent';
          }}
        >
          {isPaused ? 'Reanudar' : 'Pausar'}
        </button>
      )}
    </div>
  );
}
