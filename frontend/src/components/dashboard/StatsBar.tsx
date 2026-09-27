'use client';
import { Clock, CheckCircle, XCircle, Timer } from 'lucide-react';
import { EmailStats } from '../../types';

interface StatsBarProps {
  stats: EmailStats | null;
  loading: boolean;
}

const statItems = [
  { key: 'scheduled', label: 'Scheduled', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'sent', label: 'Sent', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
  { key: 'failed', label: 'Failed', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
  { key: 'delayed', label: 'Delayed', icon: Timer, color: 'text-amber-600', bg: 'bg-amber-50' },
] as const;

export default function StatsBar({ stats, loading }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {statItems.map(({ key, label, icon: Icon, color, bg }) => (
        <div key={key} className="card p-4 flex items-center gap-3">
          <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
          <div>
            <p className="text-xs text-ink-3 font-medium">{label}</p>
            {loading ? (
              <div className="h-5 w-10 bg-surface-2 animate-pulse rounded mt-0.5" />
            ) : (
              <p className="text-xl font-bold text-ink-1 leading-tight">
                {stats?.[key] ?? '0'}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
