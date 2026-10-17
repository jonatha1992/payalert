'use client';

import DashboardSidebar from '@/components/DashboardSidebar';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { profile, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !profile) {
            router.push('/login');
        } else if (!loading && profile?.role === 'admin') {
            router.push('/admin');
        }
    }, [profile, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
            </div>
        );
    }

    if (!profile || profile.role === 'admin') return null;

    return (
        <div className="flex min-h-screen min-w-0 bg-gray-50 dark:bg-gray-950 font-sans">
            <DashboardSidebar />
            <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pt-16 md:p-6 md:pt-6">
                <div className="w-full min-w-0 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
