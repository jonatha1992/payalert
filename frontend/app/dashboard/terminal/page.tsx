'use client';

import { useEffect, useState, useRef, type FormEvent } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabaseClient';
import { Bell, DollarSign, Clock, Store } from 'lucide-react';
import { toast } from 'sonner';

import { cashierPaymentState } from '@/lib/payments/cashierState';
type Provider = 'mercado_pago' | 'uala' | 'mock';

interface ExpectedPaymentView {
    id: string;
    amount: number;
    currency: string;
    reference: string | null;
    status: 'WAITING' | 'MATCHED' | 'MANUAL_REVIEW' | 'EXPIRED' | 'CANCELLED';

    createdAt: string;
    expiresAt: string;
    checkoutUrl: string | null;
    matchedAt: string | null;
    matchScore: number | null;
    matchCandidates: { transaction_id: string; score?: number; decision?: 'SUGGESTED' | 'MANUAL_REVIEW'; amount?: number; currency?: string; reference?: string | null; created_at?: string; expires_at?: string; provider?: string | null }[];
}

interface ConnectionView {
    id: string;
    provider: Provider;
    label: string | null;
    storeName: string | null;
    status: string;
}

interface FeedItem {
    id: string;
    amount: number;
    reference: string | null;
    created_at: string;
    status: string;
    confirmed: boolean;
    provider: string;
}

const providerNames: Record<string, string> = { mercado_pago: 'MP', uala: 'Ualá', mock: 'Test' };
const statusLabels: Record<ExpectedPaymentView['status'], string> = {
    WAITING: 'Pendiente',
    MATCHED: 'Recibido',
    MANUAL_REVIEW: 'Revisar: pago ambiguo',
    EXPIRED: 'Vencido',
    CANCELLED: 'Cancelado',
};
const inputClass = 'w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white';
const money = (amount: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
const time = (date: string) => new Date(date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function statusClass(status: ExpectedPaymentView['status']) {
    if (status === 'MATCHED') return 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300';
    if (status === 'MANUAL_REVIEW') return 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300';
    if (status === 'WAITING') return 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300';
    return 'bg-gray-100 border-gray-300 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400';
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, { cache: 'no-store', ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No pudimos completar la operación.');
    return data as T;
}

function Countdown({ expiresAt }: { expiresAt: string }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);
    const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
    return <p className="text-sm tabular-nums">{seconds > 0 ? `Vence en ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Verificando vencimiento...'}</p>;
}

export default function TerminalPage() {
    const { profile, loading } = useAuth();
    if (loading) return <div className="p-8 text-center text-gray-500">Cargando terminal...</div>;
    if (!profile) return <div className="p-8 text-center text-gray-500">Inicia sesión para usar la terminal.</div>;
    return <Terminal key={`${profile.id}:${profile.business_id}:${profile.assigned_store_id}:${profile.role}`} role={profile.role} storeId={profile.assigned_store_id} />;
}

function Terminal({ role, storeId }: { role: 'owner' | 'admin' | 'employee'; storeId?: string }) {
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const [storeName, setStoreName] = useState(storeId ? 'Cargando tienda...' : role === 'employee' ? 'Sin tienda asignada' : 'Terminal');
    const [connections, setConnections] = useState<ConnectionView[]>([]);
    const [canSelectProvider, setCanSelectProvider] = useState(false);
    const [connectionId, setConnectionId] = useState('');
    const [amount, setAmount] = useState('');
    const [reference, setReference] = useState('');
    const [activeCharge, setActiveCharge] = useState<ExpectedPaymentView | null>(null);
    const [charges, setCharges] = useState<ExpectedPaymentView[]>([]);
    const [listError, setListError] = useState('');
    const [pollError, setPollError] = useState('');
    const [refresh, setRefresh] = useState(0);
    const [busy, setBusy] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const audio = new Audio('/sounds/notification.mp3');
        audioRef.current = audio;
        return () => { audio.pause(); audioRef.current = null; };
    }, []);

    const playSound = () => {
        void audioRef.current?.play().catch(() => { /* Browser may require user interaction before audio. */ });
    };

    useEffect(() => {
        let disposed = false;
        const fetchStore = async () => {
            if (!storeId) return;
            const { data, error } = await supabase.from('stores').select('name').eq('id', storeId).single();
            if (disposed) return;
            if (data) setStoreName(data.name);
            if (error) toast.error('No pudimos cargar la tienda.');
        };
        void fetchStore();
        return () => { disposed = true; };
    }, [storeId]);

    useEffect(() => {
        if (role !== 'owner') return;
        const controller = new AbortController();
        const fetchConnections = async () => {
            try {
                const response = await fetch('/api/integrations', { cache: 'no-store', signal: controller.signal });
                if (response.status === 403) {
                    if (!controller.signal.aborted) setCanSelectProvider(false);
                    return;
                }
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'No pudimos cargar los proveedores.');
                if (!controller.signal.aborted) {
                    setConnections(data.connections);
                    setCanSelectProvider(true);
                }
            } catch (error) {
                if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : 'No pudimos cargar los proveedores.');
            }
        };
        void fetchConnections();
        return () => controller.abort();
    }, [role]);

    useEffect(() => {
        const controller = new AbortController();
        const fetchCharges = async () => {
            try {
                const data = await requestJson<{ expectedPayments: ExpectedPaymentView[] }>('/api/expected-payments', { signal: controller.signal });
                if (!controller.signal.aborted) {
                    setCharges(data.expectedPayments);
                    setListError('');
                }
            } catch (error) {
                if (!controller.signal.aborted) setListError(error instanceof Error ? error.message : 'No pudimos cargar los cobros.');
            }
        };
        void fetchCharges();
        return () => controller.abort();
    }, [refresh]);

    const activeId = activeCharge?.id;
    const activeStatus = activeCharge?.status;
    useEffect(() => {
        if (!activeId || activeStatus !== 'WAITING' || busy) return;
        const controller = new AbortController();
        let inFlight = false;
        const poll = async () => {
            if (inFlight) return;
            inFlight = true;
            try {
                const data = await requestJson<{ expectedPayment: ExpectedPaymentView }>(`/api/expected-payments/${encodeURIComponent(activeId)}`, { signal: controller.signal });
                if (controller.signal.aborted) return;
                setActiveCharge(previous => previous?.id === activeId && previous.status === 'WAITING' ? data.expectedPayment : previous);
                setCharges(previous => previous.map(charge => charge.id === activeId ? data.expectedPayment : charge));
                setPollError('');
                if (data.expectedPayment.status !== 'WAITING') window.clearInterval(timer);
            } catch (error) {
                if (!controller.signal.aborted) setPollError(error instanceof Error ? error.message : 'No pudimos actualizar el cobro.');
            } finally {
                inFlight = false;
            }
        };
        const timer = window.setInterval(() => void poll(), 3000);
        return () => { controller.abort(); window.clearInterval(timer); };
    }, [activeId, activeStatus, busy]);

    useEffect(() => {
        if (!storeId) return;
        const channel = supabase.channel('store-events').on('postgres_changes', {
            event: '*', schema: 'public', table: 'transactions', filter: `store_id=eq.${storeId}`,
        }, payload => {
            if (payload.eventType === 'DELETE') return;
            const row = payload.new;
            const providerStatus = row.provider_status;
            const confirmed = providerStatus === 'CONFIRMED';
            const status = providerStatus ? (confirmed ? 'completed' : String(providerStatus)) : String(row.status || 'pending');
            const newItem: FeedItem = {
                id: String(row.id),
                amount: Number(row.amount),
                reference: typeof row.metadata?.external_reference === 'string' ? row.metadata.external_reference : null,
                created_at: row.occurred_at || row.created_at,
                status,
                confirmed,
                provider: String(row.provider || ''),
            };
            setFeed(previous => [newItem, ...previous.filter(item => item.id !== newItem.id)].slice(0, 50));
            setRefresh(previous => previous + 1);
            if (confirmed && (payload.eventType === 'INSERT' || payload.old.provider_status !== 'CONFIRMED')) {
                playSound();
                toast.success(`Pago recibido: ${money(newItem.amount)}`);
            }
        }).subscribe();
        return () => { void supabase.removeChannel(channel); };
    }, [storeId]);

    const receiveCharge = (charge: ExpectedPaymentView) => {
        setActiveCharge(charge);
        setCharges(previous => [charge, ...previous.filter(item => item.id !== charge.id)]);
        setPollError('');
        setRefresh(previous => previous + 1);
    };

    const createCharge = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (busy) return;
        const parsedAmount = Number(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) { toast.error('Ingresa un monto válido.'); return; }
        setBusy(true);
        try {
            const data = await requestJson<{ expectedPayment: ExpectedPaymentView }>('/api/expected-payments', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: parsedAmount, reference: reference.trim() || null, ...(role === 'owner' && canSelectProvider && connectionId ? { connectionId } : {}) }),
            });
            receiveCharge(data.expectedPayment);
            setAmount('');
            setReference('');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No pudimos crear el cobro.');
            setRefresh(previous => previous + 1);
        } finally { setBusy(false); }
    };

    const cancelCharge = async () => {
        if (!activeCharge || busy) return;
        setBusy(true);
        try {
            const data = await requestJson<{ expectedPayment: ExpectedPaymentView }>(`/api/expected-payments/${encodeURIComponent(activeCharge.id)}/cancel`, { method: 'POST' });
            receiveCharge(data.expectedPayment);
        } catch (error) { toast.error(error instanceof Error ? error.message : 'No pudimos cancelar el cobro.'); }
        finally { setBusy(false); }
    };

    const resolveCandidate = async (transactionId: string) => {
        if (!activeCharge || busy) return;
        setBusy(true);
        try {
            const data = await requestJson<{ expectedPayment: ExpectedPaymentView }>(`/api/expected-payments/${encodeURIComponent(activeCharge.id)}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId }),
            });
            receiveCharge(data.expectedPayment);
            toast.success('Pago asignado al cobro.');
        } catch (error) { toast.error(error instanceof Error ? error.message : 'No pudimos confirmar el pago.'); }
        finally { setBusy(false); }
    };

    const dismissCandidate = async (transactionId: string) => {
        if (!activeCharge || busy) return;
        setBusy(true);
        try {
            await requestJson(`/api/expected-payments/${encodeURIComponent(activeCharge.id)}/candidates`, {
                method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactionId }),
            });
            await selectCharge(activeCharge.id);
        } catch (error) { toast.error(error instanceof Error ? error.message : 'No pudimos descartar el candidato.'); }
        finally { setBusy(false); }
    };

    const selectCharge = async (id: string) => {
        if (busy) return;
        setBusy(true);
        try {
            const data = await requestJson<{ expectedPayment: ExpectedPaymentView }>(`/api/expected-payments/${encodeURIComponent(id)}`);
            receiveCharge(data.expectedPayment);
        } catch (error) { toast.error(error instanceof Error ? error.message : 'No pudimos cargar el cobro.'); }
        finally { setBusy(false); }
    };

    const simulatePayment = async () => {
        if (!activeCharge || busy || role !== 'owner' || process.env.NODE_ENV === 'production') return;
        setBusy(true);
        try {
            await requestJson('/api/dev/simulate-payment', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: activeCharge.amount }),
            });
            toast.success('Pago simulado. Esperando confirmación del cobro.');
        } catch (error) { toast.error(error instanceof Error ? error.message : 'No pudimos simular el pago.'); }
        finally { setBusy(false); }
    };

    const copyCheckout = async () => {
        if (!activeCharge?.checkoutUrl) return;
        try { await navigator.clipboard.writeText(activeCharge.checkoutUrl); toast.success('Enlace copiado'); }
        catch { toast.error('No pudimos copiar el enlace. Puedes seleccionarlo y copiarlo.'); }
    };

    const today = new Date().toDateString();
    const todayCharges = charges.filter(charge => new Date(charge.createdAt).toDateString() === today)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20);

    return (
        <div className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
            <div className="bg-white dark:bg-gray-800 p-4 shadow-sm sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Store className="w-5 h-5 text-blue-500" />{storeName}</h1>
                        <p className="text-xs text-gray-500">{storeId ? 'Notificaciones en tiempo real' : 'Estado de cobros actualizado automáticamente'}</p>
                    </div>
                    <button onClick={playSound} aria-label="Probar sonido" className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 transition"><Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" /></button>
                </div>
            </div>

            <div className="p-4 space-y-4">
                <section aria-label="Flujo de cobro" className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cobro esperado → pago recibido</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">El estado se actualiza al confirmar el proveedor. Si hay más de una coincidencia, lo revisás antes de asignarlo.</p>
                    {activeCharge && <p className="mt-2 text-sm font-semibold">Estado actual: {cashierPaymentState(activeCharge).label}</p>}
                </section>
                <section className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Nuevo cobro</h2>
                    <form onSubmit={createCharge} className="space-y-3">
                        <label className="block text-sm text-gray-700 dark:text-gray-300">Monto (ARS)<input type="number" inputMode="decimal" min="0.01" max="100000000" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} className={inputClass} /></label>
                        <label className="block text-sm text-gray-700 dark:text-gray-300">Referencia (opcional)<input maxLength={120} value={reference} onChange={event => setReference(event.target.value)} className={inputClass} /></label>
                        {role === 'owner' && canSelectProvider && <label className="block text-sm text-gray-700 dark:text-gray-300">Proveedor (opcional)
                            <select value={connectionId} onChange={event => setConnectionId(event.target.value)} className={inputClass}>
                                <option value="">Sin proveedor específico</option>
                                {connections.map(connection => <option key={connection.id} value={connection.id}>{providerNames[connection.provider]}{connection.label ? ` · ${connection.label}` : ''}{connection.storeName ? ` · ${connection.storeName}` : ''}</option>)}
                            </select>
                        </label>}
                        <button disabled={busy} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50">{busy ? 'Procesando...' : 'Crear cobro'}</button>
                    </form>
                </section>

                {activeCharge && <section aria-label="Cobro activo" className={`p-6 rounded-xl border-2 space-y-3 ${statusClass(activeCharge.status)}`}>
                    <h2 role="status" className="text-2xl font-bold">{statusLabels[activeCharge.status]}</h2>
                    <p className="text-4xl font-bold tabular-nums break-words">{money(activeCharge.amount)}</p>
          <p className="break-words">{activeCharge.reference || 'Sin referencia'}</p>
                    {activeCharge.matchCandidates.length > 0 && activeCharge.status === 'MANUAL_REVIEW' && <div className="space-y-2" aria-label="Candidatos de pago">
                        <h3 className="font-semibold">Candidatos de pago</h3>
                        {activeCharge.matchCandidates.map(candidate => <div key={candidate.transaction_id} className="rounded-lg border border-current/20 p-3 space-y-1">
                            <p className="font-medium">{money(candidate.amount ?? 0)} · {candidate.currency ?? activeCharge.currency}</p>
                            <p className="text-sm">Ventana: {candidate.created_at ? time(candidate.created_at) : '—'}–{candidate.expires_at ? time(candidate.expires_at) : '—'}</p>
                            <p className="text-sm">Referencia: {candidate.reference || 'Sin referencia'} · Puntaje: {candidate.score ?? '—'}/100 · {candidate.decision === 'SUGGESTED' ? 'Sugerido' : 'Revisión manual'}</p>
                            <button disabled={busy} onClick={() => void resolveCandidate(candidate.transaction_id)} className="px-3 py-2 rounded-lg border border-current disabled:opacity-50">Confirmar este pago</button>
                            <button disabled={busy} onClick={() => void dismissCandidate(candidate.transaction_id)} className="ml-2 px-3 py-2 rounded-lg border border-current disabled:opacity-50">Descartar</button>
                        </div>)}
                    </div>}
                    {activeCharge.status === 'MATCHED' && activeCharge.matchedAt && <p className="font-semibold">Confirmado a las {time(activeCharge.matchedAt)}</p>}
                    {activeCharge.status === 'WAITING' && <Countdown key={activeCharge.id} expiresAt={activeCharge.expiresAt} />}
                    {pollError && <p role="alert" className="text-sm">{pollError} Reintentando automáticamente.</p>}
                    {activeCharge.checkoutUrl && <div className="space-y-2">
                        <label className="block text-sm">Enlace de pago<input readOnly value={activeCharge.checkoutUrl} onFocus={event => event.target.select()} className={inputClass} /></label>
                        <div className="flex gap-3">
                            <button onClick={() => void copyCheckout()} className="px-3 py-2 rounded-lg border border-current">Copiar enlace</button>
                            <a href={activeCharge.checkoutUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg border border-current">Abrir</a>
                        </div>
                    </div>}
                    {(activeCharge.status === 'WAITING' || activeCharge.status === 'MANUAL_REVIEW') && <button disabled={busy} onClick={() => void cancelCharge()} className="px-4 py-2 border border-current rounded-lg disabled:opacity-50">Cancelar</button>}
                    {process.env.NODE_ENV !== 'production' && role === 'owner' && activeCharge.status === 'WAITING' && <button disabled={busy} onClick={() => void simulatePayment()} className="block px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50">Simular pago</button>}
                </section>}

                <section className="space-y-3">
                    <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-bold text-gray-900 dark:text-white">Cobros de hoy</h2><button onClick={() => setRefresh(previous => previous + 1)} className="text-sm text-blue-600 dark:text-blue-400">Actualizar</button></div>
                    {listError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{listError}</p>}
                    {!listError && todayCharges.length === 0 && <p className="text-sm text-gray-500">No hay cobros de hoy.</p>}
                    {todayCharges.map(charge => <button key={charge.id} disabled={busy} onClick={() => void selectCharge(charge.id)} className="w-full text-left bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2 disabled:opacity-50">
                        <div className="flex justify-between gap-2"><span className="font-bold text-gray-900 dark:text-white">{money(charge.amount)}</span><span className="text-xs text-gray-500">{time(charge.createdAt)}</span></div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 break-words">{charge.reference || 'Sin referencia'}</p>
                        <span className={`inline-block text-xs px-2 py-1 rounded-full ${statusClass(charge.status)}`}>{statusLabels[charge.status]}</span>
                    </button>)}
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Notificaciones</h2>
                    {feed.length === 0 ? <div className="text-center py-10">
                        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4"><Bell className="w-8 h-8 text-gray-400" /></div>
                        <h3 className="text-gray-900 dark:text-white font-medium">Sin notificaciones</h3>
                        <p className="text-sm text-gray-500 mt-1">Las nuevas notificaciones aparecerán aquí automáticamente.</p>
                    </div> : feed.map(item => <div key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-start gap-3">
                        <div className={`p-2 rounded-lg shrink-0 ${item.confirmed ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}><DollarSign className="w-6 h-6" /></div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2 mb-1">
                                <h3 className="font-semibold text-gray-900 dark:text-white">{item.confirmed ? 'Pago Recibido' : 'Estado del pago'}</h3>
                                <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1"><Clock className="w-3 h-3" />{time(item.created_at)}</span>
                            </div>
                            {item.reference && <p className="text-gray-600 dark:text-gray-300 text-sm mb-2 break-words">{item.reference}</p>}
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-medium text-gray-600 dark:text-gray-300">{providerNames[item.provider] || '—'}</span>
                                <span className={`text-lg font-bold ${item.confirmed ? 'text-green-600 dark:text-green-500' : 'text-gray-600 dark:text-gray-300'}`}>{money(item.amount)}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{item.status}</span>
                            </div>
                        </div>
                    </div>)}
                </section>
            </div>
        </div>
    );
}
