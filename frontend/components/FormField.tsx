'use client';

import { useId, useState } from 'react';

type FormFieldProps = {
  label: string; name: string; value: string | number; onChange: (value: string) => void; onBlur: () => void; error?: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'number'; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  step?: number | string; maxLength?: number; placeholder?: string; autoComplete?: string; disabled?: boolean; className?: string; required?: boolean; icon?: React.ReactNode;
};

export function FormField({ label, name, value, onChange, onBlur, error, type = 'text', inputMode, step, maxLength, placeholder, autoComplete, disabled, className, required, icon }: FormFieldProps) {
  const generatedId = useId();
  const [show, setShow] = useState(false);
  const id = `${name}-${generatedId}`;
  const errorId = `${id}-error`;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <div className="relative">
        {icon && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">{icon}</span>}
        <input id={id} name={name} type={type === 'password' && show ? 'text' : type}
        inputMode={inputMode ?? (type === 'tel' ? 'tel' : type === 'email' ? 'email' : type === 'number' ? 'decimal' : undefined)}
        step={step} maxLength={maxLength} placeholder={placeholder} autoComplete={autoComplete} disabled={disabled} required={required}
        value={value} onChange={event => onChange(event.target.value)} onBlur={onBlur}
        aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
        className={`w-full rounded-lg border bg-gray-50 px-4 py-2 outline-none transition-all focus:ring-2 dark:bg-gray-900 ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500 dark:border-gray-700'} ${icon ? 'pl-10 ' : ''}${type === 'password' ? 'pr-11 ' : ''}${className ?? ''}`} />
        {type === 'password' && <button type="button" aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={show} onClick={() => setShow(value => !value)} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-400 dark:hover:text-gray-200" >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d={show ? 'M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9 7-.2 1.2-1.1 2.8-2.6 4.1M6.2 6.2C3.8 7.8 2.3 10 2 12c.5 2.5 4 7 10 7 1 0 1.9-.2 2.8-.5' : 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z'} />{!show && <circle cx="12" cy="12" r="3" />}</svg>
        </button>}
      </div>
      {error && <p id={errorId} role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
