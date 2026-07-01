import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';

// ============================================================
// Class Name Utility
// ============================================================
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================
// Currency Formatting
// ============================================================
export function formatCurrency(
  amount: number,
  currency = 'INR',
  symbol = '₹'
): string {
  if (currency === 'INR') {
    return `${symbol}${new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)}`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCompact(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toFixed(0)}`;
}

// ============================================================
// Date Utilities
// ============================================================
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd MMM yyyy');
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd MMM');
}

export function formatMonth(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM yyyy');
}

export function getCurrentMonth(): { from: string; to: string } {
  const now = new Date();
  return {
    from: format(startOfMonth(now), 'yyyy-MM-dd'),
    to: format(endOfMonth(now), 'yyyy-MM-dd'),
  };
}

export function getLastNMonths(n: number): { from: string; to: string } {
  const now = new Date();
  return {
    from: format(startOfMonth(subMonths(now, n - 1)), 'yyyy-MM-dd'),
    to: format(endOfMonth(now), 'yyyy-MM-dd'),
  };
}

export function getLifetimeRange(): { from: string; to: string } {
  return {
    from: '2000-01-01',
    to: format(new Date(), 'yyyy-MM-dd'),
  };
}

export function getDateRangeForPeriod(period: string): { from: string; to: string } {
  switch (period) {
    case 'current_month':
      return getCurrentMonth();
    case '3_months':
      return getLastNMonths(3);
    case '6_months':
      return getLastNMonths(6);
    case '12_months':
      return getLastNMonths(12);
    case 'lifetime':
      return getLifetimeRange();
    default:
      return getCurrentMonth();
  }
}

export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || '';
}

export function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

// ============================================================
// Number Utilities
// ============================================================
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100 * 10) / 10;
}

export function calculateSavingsRate(income: number, expenses: number): number {
  if (income === 0) return 0;
  const savings = income - expenses;
  return Math.round((savings / income) * 100 * 10) / 10;
}

// ============================================================
// Budget Status
// ============================================================
export function getBudgetStatus(
  percentage: number
): { status: 'good' | 'warning' | 'exceeded'; color: string; bgColor: string } {
  if (percentage >= 100) {
    return { status: 'exceeded', color: 'text-red-600', bgColor: 'bg-red-500' };
  }
  if (percentage >= 80) {
    return { status: 'warning', color: 'text-orange-600', bgColor: 'bg-orange-500' };
  }
  return { status: 'good', color: 'text-green-600', bgColor: 'bg-green-500' };
}

// ============================================================
// CSV Export
// ============================================================
export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        const stringValue = value === null || value === undefined ? '' : String(value);
        return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
          ? `"${stringValue.replace(/"/g, '""')}"`
          : stringValue;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================================
// String Utilities
// ============================================================
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}...`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function generateId(): string {
  return crypto.randomUUID();
}
