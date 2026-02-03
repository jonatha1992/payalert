'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Users, Store, TrendingUp, Plus, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
    const [stats, setStats] = useState({ businesses: 0, users: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            const { count: busCount } = await supabase.from('businesses').select('*', { count: 'exact', head: true });
            const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
            
            setStats({
                businesses: busCount || 0,
                users: userCount || 0
            });
            setLoading(false);
        };
        fetchStats();
    }, []);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Panel de Administración</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Control global de la plataforma PayAlert.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Negocios Totales', value: stats.businesses, icon: Store, color: 'blue' },
                    { label: 'Usuarios Totales', value: stats.users, icon: Users, color: 'purple' },
                    { label: 'Suscripciones Activas', value: stats.businesses, icon: TrendingUp, color: 'emerald' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700/50">
                        <div className={`w-12 h-12 rounded-xl bg-${stat.color}-50 dark:bg-${stat.color}-900/20 flex items-center justify-center text-${stat.color}-600 dark:text-${stat.color}-400 mb-4`}>
                            <stat.icon size={24} />
                        </div>
                        <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{stat.label}</h3>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                            {loading ? '...' : stat.value}
                        </p>
                    </div>
                ))}
            </div>

            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-10 text-white shadow-xl shadow-blue-900/20 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="max-w-md text-center md:text-left">
                    <h2 className="text-2xl font-bold mb-4">Gestión de Clientes</h2>
                    <p className="text-blue-100 opacity-80 mb-6">
                        Crea nuevos negocios, asigna dueños y gestiona sus permisos desde el panel centralizado.
                    </p>
                    <Link href="/admin/businesses" className="inline-flex items-center space-x-2 bg-white text-blue-600 font-bold py-3 px-8 rounded-xl hover:bg-blue-50 transition-colors shadow-lg">
                        <span>Ver todos los negocios</span>
                        <ArrowRight size={18} />
                    </Link>
                </div>
                <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20">
                    <div className="flex items-center space-x-4 mb-4">
                        <div className="w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center font-bold">JC</div>
                        <div>
                            <p className="font-bold">Acceso Rápido</p>
                            <p className="text-xs text-blue-200">Admin Platform</p>
                        </div>
                    </div>
                    <Link href="/admin/businesses/new" className="w-full flex items-center justify-center space-x-2 bg-blue-500 hover:bg-blue-400 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                        <Plus size={16} />
                        <span>Nuevo Cliente</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
