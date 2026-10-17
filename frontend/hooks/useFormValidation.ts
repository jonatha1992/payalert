'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { Schema } from '@/lib/validation/schemas';

type FormValues = Record<string, unknown>;

export function validateForm(schema: Schema, values: FormValues): Record<string, string> {
  const result = schema(values);
  return result.ok ? {} : result.fields;
}

export function useFormValidation<T extends FormValues>(schema: Schema, initialValues: T) {
  const [values, setValues] = useState<T>(initialValues);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const errors = useMemo(() => validateForm(schema, values), [schema, values]);
  const isValid = Object.keys(errors).length === 0;

  const change = useCallback((field: keyof T & string, value: unknown) => {
    setValues(current => ({ ...current, [field]: value }));
  }, []);

  const blur = useCallback((field: keyof T & string) => {
    setTouched(current => ({ ...current, [field]: true }));
  }, []);

  const submit = useCallback(async (event: { preventDefault(): void }, onValid: (normalized: T) => Promise<void> | void) => {
    event.preventDefault();
    if (submitLock.current) return;
    setSubmitted(true);
    setTouched(Object.fromEntries(Object.keys(values).map(key => [key, true])));
    const result = schema(values);
    if (!result.ok) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      await onValid(result.value as T);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }, [schema, values]);

  const errorFor = useCallback((field: keyof T & string) => (touched[field] || submitted ? errors[field] : undefined), [errors, submitted, touched]);

  return { values, change, blur, touched, errors, errorFor, isValid, submitting, submit };
}
