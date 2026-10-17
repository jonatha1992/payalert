'use client';

import AdminSidebar from '@/components/AdminSidebar';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { profile, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !profile) {
            router.push('/login');
        } else if (!loading && profile?.role !== 'admin') {
            router.push('/dashboard');
        }
    }, [profile, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
            </div>
        );
    }

    if (profile?.role !== 'admin') return null;

    return (
        <div className="flex min-h-screen flex-col md:flex-row bg-gray-50 dark:bg-gray-950">
            <AdminSidebar />
            <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6 overflow-x-hidden">
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
