'use client';

import { useEffect, useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormField } from '@/components/FormField';
import { useFormValidation } from '@/hooks/useFormValidation';
import type { Schema } from '@/lib/validation/schemas';
import { supabase } from '@/lib/supabaseClient';
import { validatePasswordReset } from '@/lib/passwordReset';

const resetSchema: Schema = (input) => {
  const values = input as Record<string, unknown>;
  const errors = validatePasswordReset(String(values.password ?? ''), String(values.confirmPassword ?? ''));
  return Object.keys(errors).length ? { ok: false, fields: errors } : { ok: true, value: values };
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const form = useFormValidation(resetSchema, { password: '', confirmPassword: '' });
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    const subscription = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && alive) {
        setReady(true);
        setChecking(false);
      }
    }).data.subscription;

    async function establishRecoverySession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (alive) { setError('El enlace de recuperación es inválido o venció. Pedí uno nuevo para continuar.'); setChecking(false); }
          return;
        }
        url.searchParams.delete('code');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!alive) return;
      if (session && !sessionError) setReady(true);
      else setError('El enlace de recuperación es inválido o venció. Pedí uno nuevo para continuar.');
      setChecking(false);
    }

    void establishRecoverySession();
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  async function updatePassword(event: React.FormEvent) {
    await form.submit(event, async ({ password }) => {
      if (!ready) return;
      setSaving(true);
      setError('');
      const { error: updateError } = await supabase.auth.updateUser({ password: String(password) });
      if (updateError) {
        setError(updateError.message.toLowerCase().includes('password') ? 'La contraseña no cumple los requisitos. Probá con otra de al menos 8 caracteres.' : 'No pudimos actualizar la contraseña. Volvé a intentarlo.');
        setSaving(false);
        return;
      }
      await supabase.auth.signOut();
      router.replace('/login?password_reset=success');
    });
  }

  return <main className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
    <section className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
      <div className="p-6 sm:p-8">
        <div className="mb-7 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}<img src="/icon-512x512.png" alt="" width={56} height={56} className="mb-4 h-14 w-14 rounded-2xl shadow-md" />
          <h1 className="text-center text-2xl font-bold text-gray-900 dark:text-white">Elegí una contraseña nueva</h1>
        </div>
        {checking ? <p role="status" className="text-center text-sm text-gray-600 dark:text-gray-300">Verificando el enlace…</p> : !ready ? <div>
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
          <p className="mt-5 text-center text-sm"><a href="/forgot-password" className="font-medium text-blue-600 underline underline-offset-4 dark:text-blue-400">Pedir otro enlace</a></p>
        </div> : <form onSubmit={updatePassword} className="space-y-5">
          <FormField label="Nueva contraseña" name="password" type="password" autoComplete="new-password" value={form.values.password} onChange={value => form.change('password', value)} onBlur={() => form.blur('password')} error={form.errorFor('password')} placeholder="Al menos 8 caracteres" required icon={<Lock className="h-5 w-5" />} />
          <FormField label="Confirmá la contraseña" name="confirmPassword" type="password" autoComplete="new-password" value={form.values.confirmPassword} onChange={value => form.change('confirmPassword', value)} onBlur={() => form.blur('confirmPassword')} error={form.errorFor('confirmPassword')} placeholder="Repetí la contraseña" required icon={<Lock className="h-5 w-5" />} />
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={!form.isValid || form.submitting || saving} className="flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {saving || form.submitting ? <Loader2 aria-label="Guardando" className="h-5 w-5 animate-spin" /> : 'Actualizar contraseña'}
          </button>
        </form>}
      </div>
    </section>
  </main>;
}
