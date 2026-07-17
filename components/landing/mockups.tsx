import {
  Bold,
  Italic,
  List,
  ListChecks,
  Code2,
  Image,
  Link2,
  Check,
  FolderOpen,
  GripVertical,
  Pause,
  RotateCcw,
  Flame,
  BarChart3,
} from 'lucide-react';

const CARD =
  'bg-[var(--color-surface)] rounded-2xl shadow-[var(--shadow-card)] border border-[var(--color-gray-border)] p-4 sm:p-5 select-none pointer-events-none max-w-md mx-auto';

function FakeLine({ className = '' }: { className?: string }) {
  return <div className={`h-2 rounded-full bg-[var(--color-gray-border)] ${className}`} />;
}

export function NotesMockup() {
  const toolbarIcons = [Bold, Italic, List, ListChecks, Code2, Image, Link2];
  return (
    <div className={CARD}>
      {/* Título + estado de guardado */}
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-40 rounded-full bg-[var(--color-gray-border)]" />
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)] bg-[#67b31f1a] rounded-full px-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
          Guardado
        </span>
      </div>

      {/* Toolbar simulada */}
      <div className="flex gap-1 p-1.5 rounded-lg bg-[var(--color-surface-soft)] border border-[var(--color-gray-border)] mb-4">
        {toolbarIcons.map((ToolIcon, i) => (
          <span
            key={i}
            className={`w-7 h-7 rounded flex items-center justify-center ${
              i === 0
                ? 'bg-[#67b31f1a] text-[var(--color-primary)]'
                : 'text-[var(--color-text-soft)]'
            }`}
          >
            <ToolIcon size={14} />
          </span>
        ))}
      </div>

      {/* Párrafo falso */}
      <div className="space-y-2 mb-4">
        <FakeLine className="w-full" />
        <FakeLine className="w-11/12" />
        <FakeLine className="w-3/4" />
      </div>

      {/* Task list */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded border border-[var(--color-primary)] bg-[var(--color-primary)] flex items-center justify-center">
            <Check size={10} className="text-white" />
          </span>
          <FakeLine className="w-1/2 opacity-50" />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded border border-[var(--color-gray-border)]" />
          <FakeLine className="w-2/3" />
        </div>
      </div>

      {/* Bloque de código */}
      <div className="rounded-lg p-3 bg-[#1e1e2e] space-y-2 mb-4">
        <div className="h-1.5 rounded-full bg-purple-400/70 w-1/3" />
        <div className="h-1.5 rounded-full bg-sky-400/70 w-2/3" />
        <div className="h-1.5 rounded-full bg-emerald-400/70 w-1/2" />
      </div>

      {/* Etiquetas y carpeta */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
          parcial
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[#67b31f1a] text-[#67b31f]">
          derivadas
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-soft)] ml-auto">
          <FolderOpen size={12} />
          Cálculo II
        </span>
      </div>
    </div>
  );
}

const MOCK_QUADRANTS = [
  {
    label: 'Hacer ahora',
    count: 2,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/25',
    dot: 'bg-red-500',
    cards: 2,
  },
  {
    label: 'Planificar',
    count: 3,
    color: 'text-[#67b31f] dark:text-[var(--color-primary-light)]',
    bg: 'bg-[#67b31f0d] border-[#67b31f33] dark:bg-[#67b31f1a] dark:border-[#67b31f40]',
    dot: 'bg-[#67b31f]',
    cards: 2,
  },
  {
    label: 'Delegar',
    count: 1,
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-500/10 dark:border-yellow-500/25',
    dot: 'bg-yellow-500',
    cards: 1,
  },
  {
    label: 'Eliminar',
    count: 1,
    color: 'text-gray-500 dark:text-[var(--color-text-soft)]',
    bg: 'bg-gray-50 border-gray-200 dark:bg-white/5 dark:border-[var(--color-gray-border)]',
    dot: 'bg-gray-400',
    cards: 1,
  },
];

const CATEGORY_DOTS = ['bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];

export function KanbanMockup() {
  return (
    <div className={CARD}>
      <div className="grid grid-cols-2 gap-2.5">
        {MOCK_QUADRANTS.map((q, qi) => (
          <div key={q.label} className={`rounded-xl border p-2.5 ${q.bg}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold ${q.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${q.dot}`} />
                {q.label}
              </span>
              <span className="text-[10px] text-[var(--color-text-soft)]">{q.count}</span>
            </div>
            <div className="space-y-1.5">
              {Array.from({ length: q.cards }).map((_, ci) => {
                const dragging = q.label === 'Planificar' && ci === 0;
                return (
                  <div
                    key={ci}
                    className={`bg-[var(--color-surface)] rounded-lg border p-2 shadow-sm ${
                      dragging
                        ? 'rotate-2 shadow-[var(--shadow-card-hover)] border-[var(--color-primary)]'
                        : 'border-[var(--color-gray-border)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <GripVertical size={10} className="text-[var(--color-text-soft)] shrink-0" />
                      <FakeLine className={ci % 2 === 0 ? 'w-3/4' : 'w-1/2'} />
                    </div>
                    <span className="inline-flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_DOTS[(qi + ci) % CATEGORY_DOTS.length]}`} />
                      <FakeLine className="w-8" />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const RING_RADIUS = 70;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function TimerMockup() {
  return (
    <div className={`${CARD} flex flex-col items-center gap-4 py-6`}>
      <div className="relative">
        <svg width="160" height="160" className="-rotate-90">
          <circle
            cx="80"
            cy="80"
            r={RING_RADIUS}
            fill="none"
            stroke="var(--color-gray-border)"
            strokeWidth="10"
          />
          <circle
            cx="80"
            cy="80"
            r={RING_RADIUS}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE * 0.3}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums text-[var(--color-text)]">25:00</span>
          <span className="text-xs text-[var(--color-text-soft)]">Sesión de estudio</span>
        </div>
      </div>

      {/* Controles simulados */}
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center">
          <Pause size={16} />
        </span>
        <span className="w-10 h-10 rounded-full border border-[var(--color-gray-border)] text-[var(--color-text-soft)] flex items-center justify-center">
          <RotateCcw size={14} />
        </span>
      </div>

      {/* Chips de estadísticas */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <span className="inline-flex items-center gap-1.5 bg-[var(--color-surface-soft)] border border-[var(--color-gray-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-soft)]">
          <Flame size={12} className="text-orange-500" />
          Racha: 5 días
        </span>
        <span className="inline-flex items-center gap-1.5 bg-[var(--color-surface-soft)] border border-[var(--color-gray-border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-soft)]">
          <BarChart3 size={12} className="text-[var(--color-primary)]" />
          120 min hoy
        </span>
      </div>
    </div>
  );
}
