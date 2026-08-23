'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Flame, Clock, Target, TrendingUp } from 'lucide-react';
import {
  onlyCompleted,
  dailyBuckets,
  summarize,
  formatMinutes,
  type StatsSession,
} from '@/lib/stats';
import { CategoryBreakdown } from './CategoryBreakdown';
import { StudyHeatmap } from './StudyHeatmap';
import { StudyPatterns } from './StudyPatterns';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  sessions: StatsSession[];
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-[var(--color-gray-light)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className="text-[var(--color-primary)]" />
        <span className="text-xs font-medium text-[var(--color-text-soft)]">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[var(--color-text)]">{value}</p>
      {sub && <p className="text-xs text-[var(--color-gray-mid)] mt-0.5">{sub}</p>}
    </div>
  );
}

export function StudyStats({ sessions }: Props) {
  // Todos los cálculos viven en lib/stats.ts, compartidos con el dashboard,
  // las metas y el servicio SOAP. Antes cada pantalla tenía su propia versión
  // y las cuatro daban números distintos para la misma semana.
  const stats = useMemo(() => {
    const completed = onlyCompleted(sessions);
    const now = new Date();
    const summary = summarize(completed, now);

    return {
      completed,
      hasData: completed.length > 0,
      summary,
      dailyData: dailyBuckets(completed, 7, now).map((b) => ({
        name: format(b.date, 'EEE', { locale: es }),
        minutos: b.minutes,
      })),
    };
  }, [sessions]);

  if (!stats.hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <TrendingUp size={48} className="text-[var(--color-gray-border)] mb-3" />
        <p className="text-[var(--color-text-soft)]">Sin estadísticas todavía.</p>
        <p className="text-sm text-[var(--color-gray-mid)] mt-1">Completa sesiones para ver tus datos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Clock}
          label="Esta semana"
          value={formatMinutes(stats.summary.minutesThisWeek)}
          sub="últimos 7 días"
        />
        <StatCard
          icon={Flame}
          label="Racha actual"
          value={`${stats.summary.currentStreak} día${stats.summary.currentStreak !== 1 ? 's' : ''}`}
        />
        <StatCard
          icon={Target}
          label="Más estudiada"
          value={stats.summary.topCategoryThisMonth ?? '—'}
          sub="este mes"
        />
        <StatCard
          icon={TrendingUp}
          label="Promedio diario"
          value={`${stats.summary.dailyAverage} min`}
          sub="últimos 7 días"
        />
      </div>

      {/* Bar chart */}
      <div>
        <h3 className="heading-section text-[var(--color-text)] mb-3">
          Minutos por día (últimos 7 días)
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={stats.dailyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-border)" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-text-soft)' }} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-soft)' }} />
            <Tooltip
              contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-gray-border)', fontSize: '12px' }}
            />
            <Bar dataKey="minutos" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Desglose por categoría: tabla ordenable con filtro de rango. */}
      <CategoryBreakdown sessions={stats.completed} />

      {/* Constancia: lo que ni la racha ni la barra de 7 días alcanzan a ver.
          La ventana arranca en la primera sesión, no hace un año. */}
      <StudyHeatmap sessions={stats.completed} />

      {/* Franja horaria y calidad percibida. */}
      <StudyPatterns sessions={stats.completed} />
    </div>
  );
}
