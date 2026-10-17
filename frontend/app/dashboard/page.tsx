'use client';

import { useAuth } from '@/components/AuthProvider';
import { 
    Store, 
    TrendingUp, 
    ArrowUpRight, 
    ArrowDownRight, 
    CreditCard,
    Plus,
    RefreshCw,
    ArrowUp,
    ArrowDown,
    Minus,
    Wallet,
    Calendar,
    Clock,
    Volume2,
    VolumeX
} from 'lucide-react';
import Link from 'next/link';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import audioManager from '@/lib/audioManager';

// Formatear moneda
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2
    }).format(amount);
};

// Formatear fecha
const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
        return 'Hace unos minutos';
    } else if (diffInHours < 24) {
        return `Hace ${Math.floor(diffInHours)} horas`;
    } else {
        return date.toLocaleDateString('es-AR', { 
            day: '2-digit', 
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
};

export default function DashboardPage() {
    const { profile } = useAuth();

    if (!profile) return null;

    if (profile.role === 'employee') {
        return <EmployeeTerminal profile={profile} />;
    }

    return <OwnerDashboard profile={profile} />;
}

interface Profile {
    id: string;
    first_name: string;
    email?: string;
    business_id: string;
}

interface Payment {
    id: string;
    amount: number;
    provider: string;
    store_id: string;
    created_at: string;
}

function EmployeeTerminal({ profile }: { profile: Profile }) {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [listening, setListening] = useState(false);
    const [myStores, setMyStores] = useState<Set<string>>(new Set());
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [showNotification, setShowNotification] = useState(false);
    const [lastPayment, setLastPayment] = useState<Payment | null>(null);

    // Cargar preferencia de audio
    useEffect(() => {
        const saved = localStorage.getItem('payalert_audio_enabled');
        if (saved !== null) {
            setAudioEnabled(saved === 'true');
        }
    }, []);

    // Guardar preferencia de audio
    const toggleAudio = () => {
        const newValue = !audioEnabled;
        setAudioEnabled(newValue);
        audioManager.setEnabled(newValue);
        
        if (newValue) {
            // Solicitar permiso de audio
            audioManager.requestPermission();
        }
    };

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

    useEffect(() => {
        if (myStores.size === 0) return;

        const channel = supabase
            .channel('payments-channel')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'payments' },
                (payload) => {
                    const newPayment = payload.new as Payment;
                    if (myStores.has(newPayment.store_id)) {
                        console.log('New payment received!', newPayment);
                        setPayments(prev => [newPayment, ...prev].slice(0, 10));
                        setLastPayment(newPayment);
                        setShowNotification(true);
                        
                        // Reproducir sonido
                        if (audioEnabled) {
                            audioManager.playPaymentNotification();
                        }
                        
                        // Ocultar notificación después de 3 segundos
                        setTimeout(() => setShowNotification(false), 3000);
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') setListening(true);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [myStores, audioEnabled]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Notificación de pago entrante */}
            {showNotification && lastPayment && (
                <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
                    <div className="bg-emerald-500 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center space-x-4">
                        <div className="bg-white/20 p-2 rounded-full">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="font-bold text-lg">¡Pago recibido!</p>
                            <p className="text-emerald-100">
                                ${lastPayment.amount} - {lastPayment.provider === 'mercadopago' ? 'Mercado Pago' : 'Ualá Bis'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        Terminal de Cobros
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Hola {profile.first_name || profile.email?.split('@')[0] || 'ahí'}, aquí verás los pagos entrantes en tiempo real.
                    </p>
                    <div className="mt-2 flex items-center space-x-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${listening ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                        <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                            {listening ? 'Conectado a la red de pagos' : 'Conectando...'}
                        </span>
                    </div>
                </div>
                
                {/* Botón de audio */}
                <button
                    onClick={toggleAudio}
                    className={`p-3 rounded-xl transition-all ${
                        audioEnabled 
                            ? 'bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400' 
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-500'
                    }`}
                    title={audioEnabled ? 'Sonido activado' : 'Sonido desactivado'}
                >
                    {audioEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
                </button>
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
                            Mantén esta pantalla abierta. Las notificaciones de cobro de Mercado Pago y Ualá Bis aparecerán aquí automáticamente.
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
                                             {payment.provider === 'mercadopago' ? 'Mercado Pago' : 'Ualá Bis'}
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

interface DashboardProfile {
    id: string;
    first_name: string;
    email?: string;
    business_id: string;
}

function OwnerDashboard({ profile }: { profile: DashboardProfile }) {
    // Obtener fecha de hoy
    const today = new Date().toISOString().split('T')[0];
    
    const { stats, isLoading, isError, error, refresh } = useDashboardStats({
        businessId: profile?.business_id,
        startDate: today,
        endDate: today,
        refetchInterval: 30000, // Refrescar cada 30 segundos
    });

    // Formatear cambios porcentuales
    const formatChange = (value: number) => {
        if (value > 0) return { icon: ArrowUp, color: 'text-emerald-600', bg: 'bg-emerald-100', sign: '+' };
        if (value < 0) return { icon: ArrowDown, color: 'text-rose-600', bg: 'bg-rose-100', sign: '' };
        return { icon: Minus, color: 'text-gray-600', bg: 'bg-gray-100', sign: '' };
    };

    const incomeChange = formatChange(stats?.trends?.incomeChange || 0);
    const expensesChange = formatChange(stats?.trends?.expensesChange || 0);

    // Stats para mostrar
    const dashboardStats = [
        { 
            label: 'Ventas Totales', 
            value: formatCurrency(stats?.summary?.income || 0), 
            icon: TrendingUp, 
            color: 'blue', 
            change: `${incomeChange.sign}${stats?.trends?.incomeChange || 0}%`,
            changeColor: incomeChange.color,
            changeBg: incomeChange.bg,
            sublabel: `${stats?.summary?.incomeCount || 0} transacciones`
        },
        { 
            label: 'Ingresos Hoy', 
            value: formatCurrency(stats?.summary?.income || 0), 
            icon: ArrowUpRight, 
            color: 'emerald', 
            change: `${incomeChange.sign}${stats?.trends?.incomeChange || 0}%`,
            changeColor: incomeChange.color,
            changeBg: incomeChange.bg,
            sublabel: 'vs ayer'
        },
        { 
            label: 'Egresos Hoy', 
            value: formatCurrency(stats?.summary?.expenses || 0), 
            icon: ArrowDownRight, 
            color: 'rose', 
            change: `${expensesChange.sign}${Math.abs(stats?.trends?.expensesChange || 0)}%`,
            changeColor: expensesChange.color,
            changeBg: expensesChange.bg,
            sublabel: 'vs ayer'
        },
        { 
            label: 'Balance Neto', 
            value: formatCurrency(stats?.summary?.balance || 0), 
            icon: Wallet, 
            color: 'amber', 
            change: `${stats?.summary?.activeStores || 0} sucursales`,
            changeColor: 'text-blue-600',
            changeBg: 'bg-blue-100',
            sublabel: 'activas'
        },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Cabecera */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        ¡Hola, {profile?.first_name || profile?.email?.split('@')[0] || 'ahí'}! 👋
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Aquí tienes un resumen de lo que está pasando en tu negocio hoy.
                    </p>
                </div>
                <button
                    onClick={refresh}
                    disabled={isLoading}
                    className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    <span>{isLoading ? 'Actualizando...' : 'Actualizar'}</span>
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {dashboardStats.map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700/50 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                            <div className={`p-3 rounded-xl bg-${stat.color}-50 dark:bg-${stat.color}-900/20 text-${stat.color}-600 dark:text-${stat.color}-400`}>
                                <stat.icon size={22} />
                            </div>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${stat.changeBg} dark:bg-gray-700 ${stat.changeColor} dark:text-gray-300 flex items-center gap-1`}>
                                {stat.change}
                            </span>
                        </div>
                        <div className="mt-4">
                            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{stat.label}</h3>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {isLoading ? (
                                    <span className="inline-block w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></span>
                                ) : (
                                    stat.value
                                )}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">{stat.sublabel}</p>
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

            {/* Listado de Últimos Movimientos */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Últimos Movimientos</h2>
                        <p className="text-sm text-gray-500">Transacciones más recientes de hoy</p>
                    </div>
                    <Link href="/dashboard/expenses" className="text-blue-600 dark:text-blue-400 text-sm font-semibold hover:underline flex items-center gap-1">
                        Ver todas
                        <ArrowUpRight size={16} />
                    </Link>
                </div>
                
                {isLoading ? (
                    <div className="p-8 space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse"></div>
                                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-pulse"></div>
                                </div>
                                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
                            </div>
                        ))}
                    </div>
                ) : isError ? (
                    <div className="p-12 text-center">
                        <div className="bg-red-50 dark:bg-red-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <TrendingUp size={24} className="text-red-500" />
                        </div>
                        <p className="text-gray-900 dark:text-white font-medium mb-2">Error al cargar movimientos</p>
                        <p className="text-sm text-gray-500 mb-4">{error instanceof Error ? error.message : 'Error desconocido'}</p>
                        <button 
                            onClick={refresh}
                            className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                            Reintentar
                        </button>
                    </div>
                ) : stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {stats.recentTransactions.map((transaction) => (
                            <div key={transaction.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                            transaction.type === 'income' 
                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' 
                                                : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600'
                                        }`}>
                                            {transaction.type === 'income' ? (
                                                <ArrowUpRight size={20} />
                                            ) : (
                                                <ArrowDownRight size={20} />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {transaction.description || (transaction.type === 'income' ? 'Ingreso' : 'Gasto')}
                                            </p>
                                            <p className="text-sm text-gray-500 flex items-center gap-2">
                                                <Clock size={12} />
                                                {formatDate(transaction.createdAt)}
                                                {transaction.category && (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                                                            {transaction.category}
                                                        </span>
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold ${
                                            transaction.type === 'income' 
                                                ? 'text-emerald-600' 
                                                : 'text-rose-600'
                                        }`}>
                                            {transaction.type === 'income' ? '+' : '-'}
                                            {formatCurrency(transaction.amount)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-12 text-center">
                        <div className="bg-gray-50 dark:bg-gray-900/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Calendar size={24} className="text-gray-400" />
                        </div>
                        <p className="text-gray-900 dark:text-white font-medium mb-2">No hay movimientos hoy</p>
                        <p className="text-sm text-gray-500 mb-4">Las transacciones aparecerán aquí cuando registres ingresos o gastos.</p>
                        <div className="flex justify-center gap-3">
                            <Link 
                                href="/dashboard/integrations"
                                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                            >
                                Configurar pagos
                            </Link>
                            <span className="text-gray-300">|</span>
                            <Link 
                                href="/dashboard/expenses"
                                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                            >
                                Registrar gasto
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            {/* Desglose por Tienda */}
            {stats?.storeBreakdown && stats.storeBreakdown.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700/50">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Desglose por Sucursal</h2>
                        <p className="text-sm text-gray-500">Rendimiento de cada tienda hoy</p>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {stats.storeBreakdown.map((store) => (
                            <div key={store.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-medium text-gray-900 dark:text-white">{store.name}</h3>
                                    <span className="text-sm text-gray-500">{store.transactionCount} transacciones</span>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-500">Ingresos</p>
                                        <p className="font-semibold text-emerald-600">{formatCurrency(store.income)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Egresos</p>
                                        <p className="font-semibold text-rose-600">{formatCurrency(store.expenses)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Balance</p>
                                        <p className={`font-semibold ${store.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {formatCurrency(store.balance)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
