'use client';

import { useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { FormField } from '@/components/FormField';
import { useFormValidation } from '@/hooks/useFormValidation';
import type { Schema } from '@/lib/validation/schemas';
import { validationSchemas } from '@/lib/validation/schemas';
import { toast } from 'sonner';
import { friendlyErrorMessage } from '@/lib/ui/errorMessage';
import { PASSWORD_RESET_SENT_MESSAGE } from '@/lib/passwordReset';
import { supabase } from '@/lib/supabaseClient';

const emailSchema: Schema = (input) => {
  const values = input as Record<string, unknown>;
  return validationSchemas.login({ email: values.email, password: 'validation-only' });
};

export default function ForgotPasswordPage() {
  const form = useFormValidation(emailSchema, { email: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function sendReset(event: React.FormEvent) {
    await form.submit(event, async ({ email }) => {
      setMessage('');
      setError('');
      const { error: requestError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (!requestError) {
        setMessage(PASSWORD_RESET_SENT_MESSAGE);
        toast.success('Te enviamos el enlace para cambiar la contraseña.');
        return;
      }
      const messageText = requestError.message.toLowerCase();
      if (requestError.status === 429 || messageText.includes('rate') || messageText.includes('limit') || messageText.includes('too many')) {
        setError('Se alcanzó el límite de envíos. Esperá unos minutos antes de intentar de nuevo.');
        toast.error('Se alcanzó el límite de envíos. Esperá unos minutos antes de intentar de nuevo.');
        return;
      }
      setError('No pudimos enviar el enlace ahora. Revisá tu conexión e intentá de nuevo.');
      toast.error(friendlyErrorMessage(requestError, 'No pudimos enviar el enlace ahora. Revisá tu conexión e intentá de nuevo.'));
    });
  }

  return <main className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
    <section className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
      <div className="p-6 sm:p-8">
        <div className="mb-7 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}<img src="/icon-512x512.png" alt="" width={56} height={56} className="mb-4 h-14 w-14 rounded-2xl shadow-md" />
          <h1 className="text-center text-2xl font-bold text-gray-900 dark:text-white">Recuperá tu contraseña</h1>
          <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">Ingresá tu correo y te enviaremos un enlace para cambiarla.</p>
        </div>
        <form onSubmit={sendReset} className="space-y-5">
          <FormField label="Correo electrónico" name="email" type="email" autoComplete="email" value={form.values.email} onChange={value => form.change('email', value)} onBlur={() => form.blur('email')} error={form.errorFor('email')} placeholder="usuario@ejemplo.com" required icon={<Mail className="h-5 w-5" />} />
          {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">{message}</p>}
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={!form.isValid || form.submitting} className="flex min-h-11 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {form.submitting ? <Loader2 aria-label="Enviando" className="h-5 w-5 animate-spin" /> : 'Enviar enlace'}
          </button>
        </form>
        <p className="mt-5 text-center text-sm"><a href="/login" className="font-medium text-blue-600 underline underline-offset-4 dark:text-blue-400">Volver a ingresar</a></p>
      </div>
    </section>
  </main>;
}
