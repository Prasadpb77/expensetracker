import { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Sector,
} from 'recharts';
import { formatCurrency } from '@/utils';
import type { CategoryData } from '@/types';

interface CategoryChartProps {
  data: CategoryData[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as CategoryData;

  return (
    <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-3 shadow-glass">
      <div className="flex items-center gap-2 mb-1">
        <span>{d.icon}</span>
        <span className="font-semibold text-sm text-surface-900 dark:text-surface-100">{d.category}</span>
      </div>
      <p className="text-sm font-bold text-surface-900 dark:text-surface-100">{formatCurrency(d.amount)}</p>
      <p className="text-xs text-surface-500">{d.percentage}% of total</p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
}

export function CategoryPieChart({ data }: CategoryChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const displayData = data.slice(0, 10); // Show top 10

  if (displayData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-surface-400 text-sm">
        No expense data available
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row items-center gap-4">
      <div className="w-full lg:w-1/2" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={displayData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="amount"
              activeIndex={activeIndex}
              activeShape={<ActiveShape />}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              {displayData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="w-full lg:w-1/2 space-y-2">
        {displayData.map((item, index) => (
          <div
            key={item.category}
            className="flex items-center gap-2 cursor-pointer"
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(undefined)}
          >
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-surface-600 dark:text-surface-400 flex-1 truncate">
              {item.icon} {item.category}
            </span>
            <span className="text-xs font-semibold text-surface-900 dark:text-surface-100">
              {item.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
