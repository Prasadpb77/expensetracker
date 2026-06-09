import React from 'react';
import { cn } from '@/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id || (label ? `field-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : undefined);

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-surface-700 dark:text-surface-300"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          // Never pass required — let Zod/RHF validate, not the browser
          required={undefined}
          className={cn(
            'w-full rounded-lg border bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100',
            'px-3 py-2.5 text-sm transition-colors duration-150',
            'placeholder:text-surface-400 dark:placeholder:text-surface-500',
            'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-50',
            error
              ? 'border-red-400 dark:border-red-500 focus:ring-red-500'
              : 'border-surface-200 dark:border-surface-700 hover:border-surface-300',
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
      {hint && !error && <p className="text-xs text-surface-500 mt-1">{hint}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
}

export function Select({
  label,
  error,
  hint,
  options,
  className,
  id,
  ...props
}: SelectProps) {
  const inputId = id || (label ? `field-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : undefined);

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-surface-700 dark:text-surface-300"
        >
          {label}
        </label>
      )}
      <select
        id={inputId}
        required={undefined}
        className={cn(
          'w-full rounded-lg border bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100',
          'px-3 py-2.5 text-sm transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error
            ? 'border-red-400 dark:border-red-500'
            : 'border-surface-200 dark:border-surface-700',
          className
        )}
        {...props}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
      {hint && !error && <p className="text-xs text-surface-500 mt-1">{hint}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, className, id, ...props }: TextareaProps) {
  const inputId = id || (label ? `field-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : undefined);

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-surface-700 dark:text-surface-300"
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        required={undefined}
        className={cn(
          'w-full rounded-lg border bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100',
          'px-3 py-2.5 text-sm transition-colors duration-150 resize-none',
          'placeholder:text-surface-400 dark:placeholder:text-surface-500',
          'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error
            ? 'border-red-400 dark:border-red-500'
            : 'border-surface-200 dark:border-surface-700',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
      {hint && !error && <p className="text-xs text-surface-500 mt-1">{hint}</p>}
    </div>
  );
}
