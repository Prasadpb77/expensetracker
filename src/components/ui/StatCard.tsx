import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn, formatCurrency } from '@/utils';

interface StatCardProps {
  title: string;
  amount: number;
  subtitle?: string;
  trend?: number; // percentage change
  icon: React.ReactNode;
  variant?: 'income' | 'expense' | 'savings' | 'default';
  compact?: boolean;
}

const variantConfig = {
  income: {
    bg: 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/50 dark:to-green-950/50',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    amountColor: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-100 dark:border-emerald-900/50',
  },
  expense: {
    bg: 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50',
    iconBg: 'bg-red-100 dark:bg-red-900/40',
    iconColor: 'text-red-600 dark:text-red-400',
    amountColor: 'text-red-700 dark:text-red-300',
    border: 'border-red-100 dark:border-red-900/50',
  },
  savings: {
    bg: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    amountColor: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-100 dark:border-blue-900/50',
  },
  default: {
    bg: 'bg-white dark:bg-surface-800',
    iconBg: 'bg-surface-100 dark:bg-surface-700',
    iconColor: 'text-surface-600 dark:text-surface-400',
    amountColor: 'text-surface-900 dark:text-surface-100',
    border: 'border-surface-100 dark:border-surface-700',
  },
};

export function StatCard({
  title,
  amount,
  subtitle,
  trend,
  icon,
  variant = 'default',
  compact = false,
}: StatCardProps) {
  const config = variantConfig[variant];

  const TrendIcon = trend === undefined
    ? null
    : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;

  const trendColor = trend === undefined
    ? ''
    : trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-500' : 'text-surface-400';

  return (
    <div
      className={cn(
        'rounded-xl border shadow-card transition-all duration-200 hover:shadow-card-hover',
        config.bg,
        config.border,
        compact ? 'p-4' : 'p-5'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-surface-500 dark:text-surface-400">{title}</p>
        <div className={cn('flex items-center justify-center rounded-lg p-2', config.iconBg)}>
          <div className={cn('h-4 w-4', config.iconColor)}>{icon}</div>
        </div>
      </div>

      <div>
        <p className={cn('font-display font-bold tracking-tight', config.amountColor, compact ? 'text-xl' : 'text-2xl')}>
          {formatCurrency(amount)}
        </p>

        <div className="flex items-center gap-2 mt-1">
          {subtitle && (
            <span className="text-xs text-surface-500">{subtitle}</span>
          )}
          {TrendIcon && trend !== undefined && (
            <span className={cn('flex items-center gap-0.5 text-xs font-medium', trendColor)}>
              <TrendIcon className="h-3 w-3" />
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Rate card (for savings rate %)
interface RateCardProps {
  title: string;
  rate: number;
  subtitle?: string;
  icon: React.ReactNode;
}

export function RateCard({ title, rate, subtitle, icon }: RateCardProps) {
  const isGood = rate >= 20;
  const isOkay = rate >= 10;

  return (
    <div className={cn(
      'rounded-xl border shadow-card p-5',
      isGood
        ? 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/50 dark:to-green-950/50 border-emerald-100 dark:border-emerald-900/50'
        : isOkay
          ? 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/50 dark:to-yellow-950/50 border-amber-100 dark:border-amber-900/50'
          : 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50 border-red-100 dark:border-red-900/50'
    )}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-surface-500 dark:text-surface-400">{title}</p>
        <div className={cn(
          'flex items-center justify-center rounded-lg p-2',
          isGood ? 'bg-emerald-100 dark:bg-emerald-900/40' : isOkay ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-red-100 dark:bg-red-900/40'
        )}>
          <div className={cn('h-4 w-4', isGood ? 'text-emerald-600' : isOkay ? 'text-amber-600' : 'text-red-600')}>
            {icon}
          </div>
        </div>
      </div>

      <p className={cn(
        'font-display font-bold text-2xl tracking-tight',
        isGood ? 'text-emerald-700 dark:text-emerald-300' : isOkay ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'
      )}>
        {rate.toFixed(1)}%
      </p>

      {subtitle && (
        <p className="text-xs text-surface-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
