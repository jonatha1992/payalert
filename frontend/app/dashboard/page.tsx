'use client';

import { useAuth } from '@/components/AuthProvider';
import { 
    Store, 
    TrendingUp, 
    ArrowUpRight, 
    ArrowDownRight, 
    CreditCard,
    Plus
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
    const { profile } = useAuth();

    if (!profile) return null;

    if (profile.role === 'employee') {
        return <EmployeeTerminal profile={profile} />;
    }

    return <OwnerDashboard profile={profile} />;
}

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

function EmployeeTerminal({ profile }: { profile: any }) {
    const [payments, setPayments] = useState<any[]>([]);
    const [listening, setListening] = useState(false);
    const [myStores, setMyStores] = useState<Set<string>>(new Set());

    // 1. Fetch stores to know what to listen for
    useEffect(() => {
        const fetchStores = async () => {
            if (!profile?.business_id) return;
            const { data } = await supabase
                .from('stores')
                .select('id')
                .eq('business_id', profile.business_id);
            
            if (data) {
                setMyStores(new Set(data.map(s => s.id)));
            }
        };
        fetchStores();
    }, [profile]);

    // 2. Setup Realtime Subscription
    useEffect(() => {
        if (myStores.size === 0) return;

        const channel = supabase
            .channel('payments-channel')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'payments' },
                (payload) => {
                    const newPayment = payload.new;
                    // Filter: Only show if it belongs to one of our stores
                    if (myStores.has(newPayment.store_id)) {
                        console.log('New payment received!', newPayment);
                        // Add to top of list, keep last 10
                        setPayments(prev => [newPayment, ...prev].slice(0, 10));
                        
                        // Play sound (simple beep)
                        const audio = new Audio('/sounds/notification.mp3'); // We need to add this asset later or use a base64
                        // audio.play().catch(e => console.log('Audio play failed', e)); // Browser might block
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') setListening(true);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [myStores]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Terminal de Cobros
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Hola {profile.first_name}, aquí verás los pagos entrantes en tiempo real.
                </p>
                <div className="mt-2 flex items-center space-x-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${listening ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                    <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                        {listening ? 'Conectado a la red de pagos' : 'Conectando...'}
                    </span>
                    <button 
                        onClick={() => {
                            const mockPayment = {
                                id: crypto.randomUUID(),
                                amount: (Math.random() * 10000).toFixed(2),
                                provider: Math.random() > 0.5 ? 'mercadopago' : 'uala',
                                store_id: Array.from(myStores)[0] || 'mock-store',
                                created_at: new Date().toISOString()
                            };
                            setPayments(prev => [mockPayment, ...prev].slice(0, 10));
                        }}
                        className="ml-4 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-xs rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                        Simular (Test)
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col items-center justify-center min-h-[400px] text-center relative overflow-hidden">
                {payments.length === 0 ? (
                    <>
                        <div className="relative mb-8">
                            <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping"></div>
                            <div className="bg-blue-100 dark:bg-blue-900/30 w-24 h-24 rounded-full flex items-center justify-center relative z-10 text-blue-600 dark:text-blue-400">
                                <CreditCard size={48} />
                            </div>
                        </div>
                        
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Esperando pagos...</h2>
                        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                            Mantén esta pantalla abierta. Las notificaciones de cobro de Mercado Pago y Ualá aparecerán aquí automáticamente.
                        </p>
                    </>
                ) : (
                    <div className="w-full max-w-md space-y-4">
                         {payments.map((payment) => (
                             <div key={payment.id} className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-6 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4 duration-300">
                                 <div className="flex items-center space-x-4">
                                     <div className="bg-emerald-100 dark:bg-emerald-800 text-emerald-600 dark:text-emerald-400 p-3 rounded-full">
                                         <TrendingUp size={24} />
                                     </div>
                                     <div className="text-left">
                                         <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold mb-1">
                                             {payment.provider === 'mercadopago' ? 'Mercado Pago' : 'Ualá'}
                                         </p>
                                         <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                                             ${payment.amount}
                                         </h3>
                                     </div>
                                 </div>
                                 <div className="text-right">
                                    <span className="bg-emerald-200 dark:bg-emerald-700 text-emerald-800 dark:text-emerald-100 text-xs px-2 py-1 rounded-full font-bold">
                                        APROBADO
                                    </span>
                                    <p className="text-xs text-gray-400 mt-2">Hace un momento</p>
                                 </div>
                             </div>
                         ))}
                    </div>
                )}
            </div>

            {/* Recent History (Filtered from realtime list for now) */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700/50">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Sesión Actual</h2>
                </div>
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    {payments.length > 0 ? (
                        <p>Mostrando {payments.length} notificaciones recibidas en esta sesión.</p>
                    ) : (
                        <p>No hay cobros recientes en esta sesión.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function OwnerDashboard({ profile }: { profile: any }) {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Cabecera */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    ¡Hola, {profile?.first_name}! 👋
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Aquí tienes un resumen de lo que está pasando en tu negocio hoy.
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Ventas Totales', value: '$0.00', icon: TrendingUp, color: 'blue', change: '+0%' },
                    { label: 'Ingresos Hoy', value: '$0.00', icon: ArrowUpRight, color: 'emerald', change: '+0%' },
                    { label: 'Egresos Hoy', value: '$0.00', icon: ArrowDownRight, color: 'rose', change: '+0%' },
                    { label: 'Sucursales', value: '0', icon: Store, color: 'amber', change: 'Ver todas' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700/50 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                            <div className={`p-3 rounded-xl bg-${stat.color}-50 dark:bg-${stat.color}-900/20 text-${stat.color}-600 dark:text-${stat.color}-400`}>
                                <stat.icon size={22} />
                            </div>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300`}>
                                {stat.change}
                            </span>
                        </div>
                        <div className="mt-4">
                            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{stat.label}</h3>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Acciones Rápidas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700/50 shadow-sm overflow-hidden relative group">
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors"></div>
                    
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Configuración del Sistema</h2>
                    <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                        Para empezar a recibir notificaciones de pago, debes configurar tus sucursales y conectar tus cuentas de Mercado Pago o Ualá.
                    </p>
                    
                    <div className="flex flex-wrap gap-4">
                        <Link href="/dashboard/stores" className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-600/20 hover:scale-105 active:scale-95">
                            <Store size={18} />
                            <span>Gestionar Sucursales</span>
                        </Link>
                        <Link href="/dashboard/integrations" className="inline-flex items-center space-x-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white font-semibold py-3 px-6 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-all active:scale-95">
                            <CreditCard size={18} />
                            <span>Configurar Pagos</span>
                        </Link>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-8 text-white shadow-xl shadow-blue-900/20 relative overflow-hidden flex flex-col justify-between">
                    <Plus className="absolute -top-6 -right-6 w-32 h-32 text-white/10 rotate-12" />
                    <div>
                        <h2 className="text-xl font-bold mb-2">Nuevo Empleado</h2>
                        <p className="text-blue-100 text-sm opacity-80">
                            Invita a tus cajeros para que ellos puedan registrar gastos y ver los pagos que ingresan.
                        </p>
                    </div>
                    <Link href="/dashboard/employees" className="mt-8 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-bold py-3 px-6 rounded-xl transition-all text-center border border-white/20">
                        Invitar ahora
                    </Link>
                </div>
            </div>

            {/* Listado de Ultimos Movimientos Placeholder */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700/50 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Últimos Movimientos</h2>
                    <button className="text-blue-600 dark:text-blue-400 text-sm font-semibold hover:underline">Ver reporte completo</button>
                </div>
                <div className="p-12 text-center">
                    <div className="bg-gray-50 dark:bg-gray-900/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <TrendingUp size={24} className="text-gray-400" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">No hay transacciones registradas todavía.</p>
                    <p className="text-sm text-gray-400 mt-1">Cuando conectes tus pagos, aparecerán aquí automáticamente.</p>
                </div>
            </div>
        </div>
    );
}
