'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Store, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

const menuItems = [
    { name: 'Panel Principal', href: '/admin', icon: LayoutDashboard },
    { name: 'Negocios', href: '/admin/businesses', icon: Store },
    { name: 'Configuración', href: '/admin/settings', icon: Settings },
];

export default function AdminSidebar() {
    const pathname = usePathname();
    const { signOut } = useAuth();

    return (
        <aside className="w-64 bg-gray-900 text-white min-h-screen p-4 flex flex-col">
            <div className="mb-8">
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
                    PayAlert Admin
                </h1>
            </div>
            <nav className="space-y-2 flex-1">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                }`}
                        >
                            <Icon size={20} />
                            <span>{item.name}</span>
                        </Link>
                    );
                })}
            </nav>
            <div className="mt-auto">
                <button
                    onClick={() => signOut()}
                    className="flex items-center space-x-3 px-4 py-3 w-full rounded-lg text-red-400 hover:bg-gray-800 transition-colors"
                >
                    <LogOut size={20} />
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        </aside>
    );
}
