'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Store, Settings, LogOut, Users, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

const menuItems = [
    { name: 'Panel Principal', href: '/admin', icon: LayoutDashboard },
    { name: 'Gestionar Negocios', href: '/admin/businesses', icon: Store },
    { name: 'Usuarios Globales', href: '/admin/users', icon: Users },
    { name: 'Configuración', href: '/admin/settings', icon: Settings },
];

export default function AdminSidebar() {
    const pathname = usePathname();
    const { signOut, profile } = useAuth();

    return (
        <aside className="w-full md:w-56 shrink-0 bg-slate-950 text-white min-h-0 md:min-h-screen p-3 md:p-4 flex flex-col border-b md:border-b-0 md:border-r border-slate-800 shadow-2xl">
            <div className="mb-6 px-3 pt-2">
                <div className="flex items-center space-x-2 text-blue-500 mb-1">
                    <ShieldCheck size={28} />
                    <h1 className="text-2xl font-black tracking-tighter">PayAlert</h1>
                </div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full inline-block">
                    Admin Platform
                </p>
            </div>
            
            <nav className="space-y-1.5 flex-1">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center space-x-3 px-4 py-2 rounded-lg transition-all duration-300 ${isActive
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 translate-x-1'
                                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                                }`}
                        >
                            <Icon size={18} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
                            <span className="font-semibold text-sm">{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto border-t border-slate-900 pt-4 pb-2">
                <div className="px-3 py-2 mb-3 bg-slate-900/50 rounded-xl border border-slate-800/50">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Administrador</p>
                    <p className="text-sm font-bold text-slate-200 truncate">{profile?.first_name || 'Admin'} {profile?.last_name || ''}</p>
                    <p className="text-[11px] text-slate-500 truncate">{profile?.role === 'admin' ? 'Acceso Total' : 'Restringido'}</p>
                </div>
                <button
                    onClick={() => signOut()}
                    className="flex items-center space-x-3 px-3 py-2 w-full rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-300 group"
                >
                    <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="font-bold text-sm">Cerrar Sesión</span>
                </button>
            </div>
        </aside>
    );
}
