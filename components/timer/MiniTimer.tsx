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

export function MiniTimer({ secondsLeft, phaseLabel, isRunning, isPaused, onPause, onResume }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: '#1a2e0a',
        color: 'white',
        fontFamily: 'system-ui, sans-serif',
        gap: 8,
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: 11, color: '#a0c070', textTransform: 'uppercase', letterSpacing: 1 }}>
        {phaseLabel}
      </span>
      <span style={{ fontSize: 48, fontWeight: 700, letterSpacing: 2, lineHeight: 1 }}>
        {formatDuration(secondsLeft)}
      </span>
      {isRunning && (
        <button
          onClick={isPaused ? onResume : onPause}
          style={{
            marginTop: 8,
            padding: '6px 20px',
            background: isPaused ? '#67b31f' : 'transparent',
            border: '1.5px solid #67b31f',
            color: isPaused ? 'white' : '#67b31f',
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isPaused ? 'Reanudar' : 'Pausar'}
        </button>
      )}
    </div>
  );
}
