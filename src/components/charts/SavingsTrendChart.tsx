import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { formatCurrency } from '@/utils';
import type { MonthlyData } from '@/types';

interface SavingsTrendChartProps {
  data: MonthlyData[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-3 shadow-glass">
      <p className="text-xs font-semibold text-surface-500 mb-2">{label}</p>
      <div className="flex items-center gap-2 text-sm">
        <div className="w-2 h-2 rounded-full bg-blue-500" />
        <span className="text-surface-600 dark:text-surface-400">Savings:</span>
        <span className={`font-semibold ${payload[0].value >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
          {formatCurrency(payload[0].value)}
        </span>
      </div>
    </div>
  );
}

export function SavingsTrendChart({ data }: SavingsTrendChartProps) {
  const formattedData = data.map(d => ({
    month: format(parseISO(`${d.month}-01`), 'MMM yy'),
    savings: d.income - d.expenses,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formattedData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
        <defs>
          <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-surface-200, #e2e8f0)"
          vertical={false}
        />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: 'var(--color-surface-500, #64748b)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--color-surface-500, #64748b)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="savings"
          stroke="#2563eb"
          strokeWidth={2}
          fill="url(#savingsGradient)"
          dot={{ fill: '#2563eb', strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
