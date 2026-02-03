'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabaseClient';
import { Bell, DollarSign, Clock, Store } from 'lucide-react';
import { toast } from 'sonner';

interface FeedItem {
    id: string;
    type: 'payment' | 'notification' | 'system';
    amount?: number;
    description: string;
    created_at: string;
    status: 'pending' | 'completed' | 'failed';
}

export default function TerminalPage() {
    const { profile, loading } = useAuth();
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const [storeName, setStoreName] = useState<string>('Cargando tienda...');
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Initialize Audio
    useEffect(() => {
        audioRef.current = new Audio('/sounds/notification.mp3'); // We need to add this file
    }, []);

    const playSound = () => {
        if (audioRef.current) {
            audioRef.current.play().catch(err => console.error('Audio play failed', err));
        }
    };

    // Fetch Assigned Store
    useEffect(() => {
        const fetchStore = async () => {
            if (profile?.assigned_store_id) {
                const { data, error } = await supabase
                    .from('stores')
                    .select('name')
                    .eq('id', profile.assigned_store_id)
                    .single();
                
                if (data) setStoreName(data.name);
            } else if (!loading && profile) {
                setStoreName('Sin tienda asignada');
                toast.error('No tienes una tienda asignada. Contacta a tu administrador.');
            }
        };

        if (profile) fetchStore();
    }, [profile, loading]);

    // Setup Realtime Subscription
    useEffect(() => {
        if (!profile?.assigned_store_id) return;

        console.log('Setting up realtime for store:', profile.assigned_store_id);

        // TODO: Subscribe to 'transactions' or 'notifications' table
        // For now, mocking subscription or assuming 'payment_notifications' table exists or using transactions
        // Let's assume we listen to 'payment_intents' or similar logical table.
        // Or 'transactions' for now.

        const channel = supabase
            .channel('store-events')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'transactions',
                    filter: `store_id=eq.${profile.assigned_store_id}` 
                },
                (payload) => {
                    console.log('New Transaction:', payload);
                    playSound();
                    const newItem: FeedItem = {
                        id: payload.new.id,
                        type: 'payment',
                        amount: payload.new.amount,
                        description: payload.new.description || 'Nuevo pago recibido',
                        created_at: payload.new.created_at,
                        status: payload.new.status || 'completed'
                    };
                    setFeed(prev => [newItem, ...prev]);
                    toast.success(`Nuevo pago: $${payload.new.amount}`);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile]);

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando terminal...</div>;

    return (
        <div className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 p-4 shadow-sm sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Store className="w-5 h-5 text-blue-500" />
                            {storeName}
                        </h1>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Conectado en tiempo real
                        </p>
                    </div>
                    <button onClick={playSound} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 transition">
                        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>
                </div>
            </div>

            {/* Feed */}
            <div className="p-4 space-y-4">
                {feed.length === 0 ? (
                    <div className="text-center py-10">
                        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Bell className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-gray-900 dark:text-white font-medium">Sin notificaciones</h3>
                        <p className="text-sm text-gray-500 mt-1">Las nuevas alertas aparecerán aquí.</p>
                    </div>
                ) : (
                    feed.map(item => (
                        <div key={item.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-4">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg shrink-0">
                                <DollarSign className="w-6 h-6 text-green-600 dark:text-green-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                                        Pago Recibido
                                    </h4>
                                    <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">{item.description}</p>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-medium text-gray-600 dark:text-gray-300">
                                        MP
                                    </span>
                                    <span className="text-lg font-bold text-green-600 dark:text-green-500">
                                        ${item.amount?.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
