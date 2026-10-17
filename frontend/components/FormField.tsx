'use client';

import { useId } from 'react';

type FormFieldProps = {
  label: string; name: string; value: string | number; onChange: (value: string) => void; onBlur: () => void; error?: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'number'; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  step?: number | string; maxLength?: number; placeholder?: string; autoComplete?: string; disabled?: boolean; className?: string; required?: boolean; icon?: React.ReactNode;
};

export function FormField({ label, name, value, onChange, onBlur, error, type = 'text', inputMode, step, maxLength, placeholder, autoComplete, disabled, className, required, icon }: FormFieldProps) {
  const generatedId = useId();
  const id = `${name}-${generatedId}`;
  const errorId = `${id}-error`;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <div className="relative">
        {icon && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">{icon}</span>}
        <input id={id} name={name} type={type}
        inputMode={inputMode ?? (type === 'tel' ? 'tel' : type === 'email' ? 'email' : type === 'number' ? 'decimal' : undefined)}
        step={step} maxLength={maxLength} placeholder={placeholder} autoComplete={autoComplete} disabled={disabled} required={required}
        value={value} onChange={event => onChange(event.target.value)} onBlur={onBlur}
        aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
        className={`w-full rounded-lg border bg-gray-50 px-4 py-2 outline-none transition-all focus:ring-2 dark:bg-gray-900 ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500 dark:border-gray-700'} ${icon ? 'pl-10 ' : ''}${className ?? ''}`} />
      </div>
      {error && <p id={errorId} role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
