'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Flame, Clock, Target, TrendingUp } from 'lucide-react';
import type { StudySession } from '@/lib/types';
import { format, subDays, startOfDay, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  sessions: (StudySession & { category?: { name: string; color: string } | null })[];
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
  const completedSessions = sessions.filter((s) => s.completed_at !== null);

  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = subDays(now, 7);
    const monthAgo = subDays(now, 30);

    // Minutes this week
    const weekMinutes = completedSessions
      .filter((s) => new Date(s.started_at) >= weekAgo)
      .reduce((acc, s) => acc + s.duration_minutes, 0);

    // Daily data for last 7 days
    const dailyData = Array.from({ length: 7 }, (_, i) => {
      const day = subDays(now, 6 - i);
      const dayStr = startOfDay(day).toISOString().slice(0, 10);
      const minutes = completedSessions
        .filter((s) => s.started_at.slice(0, 10) === dayStr)
        .reduce((acc, s) => acc + s.duration_minutes, 0);
      return {
        name: format(day, 'EEE', { locale: es }),
        minutos: minutes,
      };
    });

    // Streak
    let streak = 0;
    let checkDay = now;
    while (true) {
      const dayStr = startOfDay(checkDay).toISOString().slice(0, 10);
      const hasSession = completedSessions.some((s) => s.started_at.slice(0, 10) === dayStr);
      if (!hasSession) break;
      streak++;
      checkDay = subDays(checkDay, 1);
    }

    // Category distribution
    const categoryMap = new Map<string, { name: string; color: string; minutes: number }>();
    completedSessions
      .filter((s) => new Date(s.started_at) >= monthAgo)
      .forEach((s) => {
        if (!s.category) return;
        const key = s.category.name;
        const existing = categoryMap.get(key);
        if (existing) {
          existing.minutes += s.duration_minutes;
        } else {
          categoryMap.set(key, { name: s.category.name, color: s.category.color, minutes: s.duration_minutes });
        }
      });

    const categoryData = Array.from(categoryMap.values());

    // Most studied category this month
    const topCategory = categoryData.sort((a, b) => b.minutes - a.minutes)[0];

    // Daily average
    const daysWithSessions = new Set(completedSessions.map((s) => s.started_at.slice(0, 10))).size;
    const totalMinutes = completedSessions.reduce((acc, s) => acc + s.duration_minutes, 0);
    const avgDaily = daysWithSessions > 0 ? Math.round(totalMinutes / daysWithSessions) : 0;

    return { weekMinutes, dailyData, streak, categoryData, topCategory, avgDaily };
  }, [sessions]);

  if (completedSessions.length === 0) {
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
          value={`${Math.round(stats.weekMinutes / 60)}h ${stats.weekMinutes % 60}m`}
        />
        <StatCard
          icon={Flame}
          label="Racha actual"
          value={`${stats.streak} día${stats.streak !== 1 ? 's' : ''}`}
        />
        <StatCard
          icon={Target}
          label="Más estudiada"
          value={stats.topCategory?.name ?? '—'}
          sub="este mes"
        />
        <StatCard
          icon={TrendingUp}
          label="Promedio diario"
          value={`${stats.avgDaily} min`}
        />
      </div>

      {/* Bar chart */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">
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

      {/* Pie chart */}
      {stats.categoryData.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)] mb-3">
            Distribución por categoría (este mes)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={stats.categoryData}
                dataKey="minutes"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {stats.categoryData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-gray-border)', fontSize: '12px' }}
                formatter={(value: unknown) => [`${value ?? 0} min`, 'Tiempo'] as [string, string]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
