import React from 'react';

import { cn } from '@/utils';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-surface-200 dark:bg-surface-700',
        className
      )}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-100 dark:border-surface-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-32 mb-1" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="h-64 flex items-end gap-2 px-4 pb-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex-1">
          <Skeleton
            className="w-full rounded-t-sm"
            style={{ height: `${Math.random() * 80 + 20}%` }}
          />
        </div>
      ))}
    </div>
  );
}
