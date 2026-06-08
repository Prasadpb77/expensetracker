
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { formatCurrency } from '@/utils';
import type { MonthlyData } from '@/types';

interface IncomeExpenseChartProps {
  data: MonthlyData[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-3 shadow-glass">
      <p className="text-xs font-semibold text-surface-500 mb-2">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-surface-600 dark:text-surface-400">{entry.name}:</span>
          <span className="font-semibold text-surface-900 dark:text-surface-100">
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function IncomeExpenseChart({ data }: IncomeExpenseChartProps) {
  const formattedData = data.map(d => ({
    ...d,
    month: format(parseISO(`${d.month}-01`), 'MMM yy'),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={formattedData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
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
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '12px' }}
        />
        <Bar dataKey="income" name="Income" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={40} />
        <Bar dataKey="expenses" name="Expenses" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
