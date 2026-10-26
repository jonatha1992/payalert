'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Circle, CreditCard, Plug, Store, Users } from 'lucide-react';

type Overview = {
  businesses: number; users: number;
  apps: { total: number; unconnected: number };
  connections: { total: number; mercado_pago: { total: number; connected: number; disconnected: number }; uala: { total: number; connected: number; disconnected: number } };
  charges: { today: { approved: number; pending: number }; month: { approved: number; pending: number } };
  activity: { action: string; created_at: string; actor: string }[];
};

const card = 'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800';

async function fetchOverview(): Promise<Overview> {
  const response = await fetch('/api/admin/overview');
  if (!response.ok) throw new Error('No pudimos cargar el resumen del sistema.');
  return response.json();
}

export default function AdminDashboard() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['admin-overview'], queryFn: fetchOverview });
  const checklist = data ? [
    { label: 'Conectar Mercado Pago', done: data.connections.mercado_pago.connected > 0 },
    { label: 'Crear una app vinculada', done: data.apps.total > 0 },
    { label: 'Generar enlace de invitación', done: data.apps.total > data.apps.unconnected },
  ] : [];
  const value = (n: number) => isLoading ? '…' : n;

  return <main className="min-w-0 space-y-6 animate-in fade-in duration-500">
    <header><h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Panel de Administración</h1><p className="mt-1 text-gray-500 dark:text-gray-400">Resumen operativo del sistema PayAlert.</p></header>
    {isError && <div role="alert" className={`${card} border-red-300 text-red-700 dark:text-red-300`}>No pudimos cargar la información. Actualizá la página para volver a intentar.</div>}
    <section className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: 'Negocios totales', amount: data?.businesses ?? 0, icon: Store },
        { label: 'Usuarios totales', amount: data?.users ?? 0, icon: Users },
        { label: 'Apps vinculadas', amount: data?.apps.total ?? 0, icon: Plug },
        { label: 'Sin conectar', amount: data?.apps.unconnected ?? 0, icon: CreditCard },
      ].map(({ label, amount, icon: Icon }) => <article key={label} className={card}><Icon className="mb-3 text-blue-500" size={23} /><p className="text-sm text-gray-500 dark:text-gray-400">{label}</p><p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{value(amount)}</p></article>)}
    </section>
    <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
      <article className={card}><h2 className="mb-4 font-semibold text-gray-900 dark:text-white">Conexiones de pago <span className="text-sm font-normal text-gray-500">({value(data?.connections.total ?? 0)} total)</span></h2>
        {(['mercado_pago', 'uala'] as const).map((key) => { const item = data?.connections[key]; return <div key={key} className="flex min-w-0 justify-between gap-3 border-t border-gray-100 py-3 text-sm dark:border-gray-700"><span className="capitalize text-gray-700 dark:text-gray-300">{key === 'mercado_pago' ? 'Mercado Pago' : 'Ualá'}</span><span className="text-right text-gray-500">{isLoading ? '…' : item ? `${item.connected} conectadas · ${item.disconnected} desconectadas` : '0 conexiones'}</span></div>; })}
      </article>
      <article className={card}><h2 className="mb-4 font-semibold text-gray-900 dark:text-white">Cobros del hub</h2>{!isLoading && data?.charges.today.approved === 0 && data.charges.today.pending === 0 && data.charges.month.approved === 0 && data.charges.month.pending === 0 ? <p className="text-sm text-gray-500">Todavía no hay cobros registrados.</p> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{(['today', 'month'] as const).map((period) => <div key={period} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/50"><p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{period === 'today' ? 'Hoy' : 'Este mes'}</p><p className="text-sm text-gray-500">Aprobados: {value(data?.charges[period].approved ?? 0)}</p><p className="text-sm text-gray-500">Pendientes: {value(data?.charges[period].pending ?? 0)}</p></div>)}</div>}</article>
    </section>
    <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
      <article className={card}><div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold text-gray-900 dark:text-white">Apps vinculadas</h2><Link href="/admin/client-apps" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">Administrar <ArrowRight size={15} /></Link></div><p className="text-sm text-gray-500">{isLoading ? 'Cargando…' : `${data?.apps.unconnected ?? 0} apps sin conexión de pago.`}</p></article>
      <article className={card}><h2 className="mb-3 font-semibold text-gray-900 dark:text-white">Próximos pasos</h2>{isLoading ? <p className="text-sm text-gray-500">Cargando checklist…</p> : checklist.map((item) => <p key={item.label} className="flex items-center gap-2 py-1.5 text-sm text-gray-700 dark:text-gray-300">{item.done ? <CheckCircle2 size={17} className="shrink-0 text-emerald-500" /> : <Circle size={17} className="shrink-0 text-gray-400" />}{item.label}</p>)}</article>
    </section>
    <article className={card}><h2 className="mb-3 font-semibold text-gray-900 dark:text-white">Actividad reciente</h2>{isLoading ? <p className="text-sm text-gray-500">Cargando actividad…</p> : !data?.activity.length ? <p className="text-sm text-gray-500">Todavía no hay actividad de auditoría.</p> : <ul className="divide-y divide-gray-100 dark:divide-gray-700">{data.activity.map((event, index) => <li key={`${event.created_at}-${index}`} className="flex min-w-0 flex-col gap-1 py-3 text-sm sm:flex-row sm:justify-between"><span className="break-words text-gray-700 dark:text-gray-300">{event.action.replaceAll('_', ' ')} · {event.actor}</span><time className="shrink-0 text-xs text-gray-500">{new Date(event.created_at).toLocaleString('es-AR')}</time></li>)}</ul>}</article>
  </main>;
}
