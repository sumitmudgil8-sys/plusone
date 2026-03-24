'use client';

import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    positive: boolean;
  };
  className?: string;
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
}: StatsCardProps) {
  return (
    <Card className={cn('flex items-start justify-between', className)}>
      <div>
        <p className="text-sm text-white/50 mb-1">{title}</p>
        <p className="text-3xl font-bold text-white">{value}</p>
        {(subtitle || trend) && (
          <div className="flex items-center gap-2 mt-2">
            {trend && (
              <span
                className={cn(
                  'text-sm',
                  trend.positive ? 'text-success' : 'text-error'
                )}
              >
                {trend.positive ? '↑' : '↓'} {trend.value}
              </span>
            )}
            {subtitle && (
              <span className="text-sm text-white/40">{subtitle}</span>
            )}
          </div>
        )}
      </div>
      <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
        {icon}
      </div>
    </Card>
  );
}
