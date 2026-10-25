'use client';

import { useEffect, useState } from 'react';

type LinkState = { slug: string; error?: string };
export default function ConnectPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState('');
  const [state, setState] = useState<LinkState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void params.then(({ token: value }) => { setToken(value); void fetch(`/api/connect/${value}`).then(async (response) => { const body = await response.json(); setState(response.ok ? body : { slug: '', error: response.status === 410 ? 'Este enlace venció o ya fue utilizado. Pedile a Huellitas que genere uno nuevo.' : 'No pudimos validar el enlace. Probá de nuevo más tarde.' }); }); }); }, [params]);
  async function connect() {
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/connect/${token}`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok || typeof body.authorizationUrl !== 'string') throw new Error(body.error === 'oauth_unavailable' ? 'La conexión con Mercado Pago no está disponible en este momento.' : 'No pudimos iniciar la conexión. Probá de nuevo.');
      window.location.assign(body.authorizationUrl);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos iniciar la conexión.'); setLoading(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4"><section className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-lg"><h1 className="text-2xl font-bold text-slate-900">Conectá tu cuenta de Mercado Pago</h1>{!state ? <p className="mt-4 text-slate-600">Validando el enlace…</p> : state.error ? <p role="alert" className="mt-4 text-red-700">{state.error}</p> : <><p className="mt-4 text-slate-600">Conectá tu cuenta de Mercado Pago para cobrar las señas de <strong>{state.slug}</strong>.</p><button type="button" onClick={() => void connect()} disabled={loading} className="mt-7 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{loading ? 'Conectando…' : 'Conectar con Mercado Pago'}</button>{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}</>}</section></main>;
}
