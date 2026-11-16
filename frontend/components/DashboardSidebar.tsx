'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Store, CreditCard, Users, Settings, LogOut, FileText, DollarSign } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

export default function DashboardSidebar() {
    const pathname = usePathname();
    const { signOut, profile } = useAuth();

    const ownerItems = [
        { name: 'Mi Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Mis Sucursales', href: '/dashboard/stores', icon: Store },
        { name: 'Reportes', href: '/dashboard/reports', icon: FileText },
        { name: 'Integraciones', href: '/dashboard/integrations', icon: CreditCard },
        { name: 'Gastos', href: '/dashboard/expenses', icon: DollarSign },
        { name: 'Empleados', href: '/dashboard/employees', icon: Users },
        { name: 'Configuración', href: '/dashboard/settings', icon: Settings },
    ];

    const employeeItems = [
        { name: 'Terminal', href: '/dashboard/terminal', icon: CreditCard },
        //{ name: 'Historial', href: '/dashboard/history', icon: LayoutDashboard },
    ];

    const items = profile?.role === 'employee' ? employeeItems : ownerItems;

    return (
        <aside className="w-64 bg-gray-900 text-white min-h-screen p-4 flex flex-col border-r border-gray-800">
            <div className="mb-8 px-4">
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-600">
                    PayAlert
                </h1>
                <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-semibold">
                    {profile?.role === 'employee' ? 'Terminal Empleado' : 'Panel de Dueño'}
                </p>
            </div>
            
            <nav className="space-y-1 flex-1">
                {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                                ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20 shadow-[0_0_15px_rgba(37,99,235,0.1)]'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                }`}
                        >
                            <Icon size={20} className={isActive ? 'text-blue-400' : 'text-gray-500'} />
                            <span className="font-medium text-sm">{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto border-t border-gray-800 pt-4">
                <div className="px-4 py-2 mb-3 min-w-0">
                    <p title={profile?.email || undefined} className="text-xs text-gray-400 truncate">{profile?.email || ''}</p>
                </div>
                <button
                    onClick={() => signOut()}
                    className="flex items-center space-x-3 px-4 py-3 w-full rounded-xl text-red-400 hover:bg-red-400/10 hover:text-red-300 transition-all duration-200 group"
                >
                    <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
                    <span className="font-medium text-sm">Cerrar Sesión</span>
                </button>
            </div>
        </aside>
    );
}
