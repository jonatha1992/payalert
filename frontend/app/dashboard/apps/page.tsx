'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type App = {
  slug: string;
  active: boolean;
  allowed_origins: string[];
  deposit_default: number;
  connect_return_url: string | null;
  connected: boolean;
  account: { provider: string; provider_account_id: string | null } | null;
};
type Charge = { amount: number; status: string; created_at: string; app: string };
type AdminData<T> = { data: T; error: string | null; loading: boolean };

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const statuses: Record<string, string> = {
  creating: 'Creando', pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado',
  expired: 'Vencido', refunding: 'Reintegrando', refunded: 'Reintegrado', needs_refund: 'Requiere reintegro',
};

async function load<T>(url: string, key: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('No se pudieron cargar los datos.');
  const body = await response.json() as Record<string, T>;
  return body[key];
}

function useAdminData<T>(url: string, key: string): AdminData<T | null> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    load<T>(url, key).then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setError('No pudimos cargar esta información. Probá de nuevo más tarde.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [url, key]);
  return { data, error, loading };
}

export default function AppsPage() {
  const apps = useAdminData<App[]>('/api/admin/apps', 'apps');
  const charges = useAdminData<Charge[]>('/api/admin/charges', 'charges');
  const params = useSearchParams(); const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [connecting, setConnecting] = useState<string | null>(null);
  useEffect(() => { const slug = params.get('connected'); const status = params.get('mp'); if (slug && status) { setNotice(status === 'connected' ? 'Mercado Pago conectado a ' + slug : 'No se pudo conectar Mercado Pago a ' + slug + '. Probá de nuevo.'); window.history.replaceState({}, '', '/dashboard/apps'); } }, [params]);
  async function connect(app: App) { if (app.connected && !window.confirm('Esto reemplaza la cuenta actual. ¿Querés continuar?')) return; setConnecting(app.slug); setError(''); try { const response = await fetch('/api/admin/apps/' + encodeURIComponent(app.slug) + '/connect', { method: 'POST' }); const body = await response.json() as { url?: string; error?: string }; if (!response.ok || !body.url) throw new Error(body.error || 'No pudimos iniciar la conexión.'); window.location.assign(body.url); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos iniciar la conexión.'); setConnecting(null); } }
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Apps conectadas</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">Estado de las apps, sus cuentas de Mercado Pago y los cobros del hub.</p>
      </header>
      <section aria-labelledby="apps-heading" className="space-y-4">
        <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100"><strong>Para cobrar, conectá la cuenta de Mercado Pago de cada página</strong><p className="mt-1">Vas a pasar a Mercado Pago, iniciá sesión con la cuenta que va a recibir las señas.</p></div>{notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{notice}</p>}{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
        {apps.loading ? <p role="status">Cargando apps…</p> : apps.error ? <p role="alert">{apps.error}</p> : !apps.data?.length ? <Empty text="Todavía no hay apps." /> : (
          <div className="grid gap-4 md:grid-cols-2">
            {apps.data.map((app) => (
              <article key={app.slug} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="break-all text-lg font-semibold text-gray-900 dark:text-white">{app.slug}</h3>
                  <span className={app.connected ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-300'}>{app.connected ? '✓ Conectada' : '○ Sin conectar'}</span>
                </div>
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Dominios: {app.allowed_origins.length ? app.allowed_origins.join(', ') : 'Sin dominios configurados'}</p>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">Seña por defecto: {money.format(app.deposit_default)}</p>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">Cuenta de Mercado Pago: {app.account?.provider_account_id ?? 'Sin cuenta asociada'}</p>
                {!app.active && <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">App inactiva</p>}
                <button type="button" disabled={!app.active || connecting !== null} onClick={() => void connect(app)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800 disabled:opacity-50"><span aria-hidden="true">↗</span>{connecting === app.slug ? 'Abriendo Mercado Pago…' : app.connected ? 'Reconectar Mercado Pago' : 'Conectar Mercado Pago'}</button>
              </article>
            ))}
          </div>
        )}
      </section>
      <section aria-labelledby="charges-heading" className="space-y-4">
        <h2 id="charges-heading" className="text-xl font-semibold text-gray-900 dark:text-white">Cobros recientes</h2>
        {charges.loading ? <p role="status">Cargando cobros…</p> : charges.error ? <p role="alert">{charges.error}</p> : !charges.data?.length ? <Empty text="Todavía no hay cobros del hub." /> : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {charges.data.map((charge, index) => (
                <article key={`${charge.app}-${charge.created_at}-${index}`} className="grid gap-2 p-4 sm:grid-cols-4 sm:items-center">
                  <strong className="text-gray-900 dark:text-white">{money.format(charge.amount)}</strong>
                  <span className="text-sm text-gray-700 dark:text-gray-200">{statuses[charge.status] ?? charge.status}</span>
                  <time className="text-sm text-gray-500 dark:text-gray-400" dateTime={charge.created_at}>{new Date(charge.created_at).toLocaleString('es-AR')}</time>
                  <span className="break-all text-sm text-gray-700 dark:text-gray-200">{charge.app}</span>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600 dark:border-gray-700 dark:text-gray-300">{text}</div>;
}
