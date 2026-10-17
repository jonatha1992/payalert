'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Store, CreditCard, Users, Settings, LogOut, FileText, DollarSign, ChevronLeft, Menu, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useSidebarState } from '@/hooks/useSidebarState';

export default function DashboardSidebar() {
    const pathname = usePathname();
    const { signOut, profile } = useAuth();
    const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen, closeMobile } = useSidebarState();

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
        <>
            <header className="sidebar-mobile-bar"><button type="button" aria-label="Abrir menú" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="rounded-lg p-2"><Menu size={22} /></button><span className="font-semibold">PayAlert</span></header>
            {mobileOpen && <button type="button" aria-label="Cerrar menú" onClick={closeMobile} className="sidebar-backdrop" />}
            <aside className={`sidebar-shell bg-gray-900 border-gray-800 ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
                <div className="sidebar-heading mb-8 px-4">
                    <div className="sidebar-brand min-w-0"><h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-600">PayAlert</h1>
                        <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-semibold">{profile?.role === 'employee' ? 'Terminal Empleado' : 'Panel de Dueño'}</p></div>
                    <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'} aria-expanded={!collapsed} title={collapsed ? 'Expandir menú' : 'Contraer menú'} className="sidebar-toggle hidden md:flex"><ChevronLeft size={18} className={collapsed ? 'rotate-180' : ''} /></button>
                    <button type="button" onClick={closeMobile} aria-label="Cerrar menú" className="sidebar-mobile-close md:hidden"><X size={20} /></button>
                </div>
                <nav className="space-y-1 flex-1" onClick={(event) => { if ((event.target as HTMLElement).closest('a')) closeMobile(); }}>
                {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={collapsed ? item.name : undefined}
                            className={`sidebar-link ${isActive
                                ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20 shadow-[0_0_15px_rgba(37,99,235,0.1)]'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                }`}
                        >
                            <Icon size={18} className={isActive ? 'text-blue-400' : 'text-gray-500'} />
                            <span className="sidebar-label font-medium text-sm">{item.name}</span>
                        </Link>
                    );
                })}
                </nav>

            <div className="mt-auto border-t border-gray-800 pt-4">
                <div className="sidebar-user px-3 py-2 mb-3 bg-gray-800/50 rounded-xl border border-gray-700/50">
                    <p className="text-xs text-gray-500">Sesión como</p>
                    <p className="text-sm font-medium text-gray-200 truncate">{profile?.first_name || profile?.email || 'Usuario'} {profile?.last_name}</p>
                </div>
                <button
                    onClick={() => signOut()}
                    title={collapsed ? 'Cerrar Sesión' : undefined}
                    className="sidebar-link w-full rounded-lg text-red-400 hover:bg-red-400/10 hover:text-red-300 transition-all duration-200 group"
                >
                    <LogOut size={18} className="group-hover:translate-x-1 transition-transform" />
                    <span className="sidebar-label font-medium text-sm">Cerrar Sesión</span>
                </button>
            </div>
            </aside>
        </>
    );
}
