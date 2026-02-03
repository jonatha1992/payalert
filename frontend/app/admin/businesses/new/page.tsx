'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function NewBusinessPage() {
    const [name, setName] = useState('');
    // Mercado Pago
    const [mpAccessToken, setMpAccessToken] = useState('');
    const [mpPublicKey, setMpPublicKey] = useState('');
    // Uala
    const [ualaClientId, setUalaClientId] = useState('');
    const [ualaClientSecret, setUalaClientSecret] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const userId = user?.id;

            const settings = {
                payments: {
                    mercado_pago: {
                        access_token: mpAccessToken,
                        public_key: mpPublicKey,
                        enabled: !!mpAccessToken
                    },
                    uala: {
                        client_id: ualaClientId,
                        client_secret: ualaClientSecret,
                        enabled: !!ualaClientId
                    }
                }
            };

            const payload: any = { 
                name,
                settings
            };

            const { error } = await supabase
                .from('businesses')
                .insert([payload]);

            if (error) throw error;

            router.push('/admin/businesses');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Nuevo Negocio</h1>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del Negocio</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="Ej. Mi Tienda Genial"
                            required
                        />
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Configuración de Pagos</h2>
                        
                        <div className="space-y-4">
                            {/* Mercado Pago */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                                <div className="flex items-center space-x-3 mb-4">
                                    <input 
                                        type="checkbox" 
                                        checked={!!mpAccessToken} 
                                        readOnly 
                                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    />
                                    <div className="flex items-center space-x-2">
                                        {/* Mock Logo using CSS */}
                                        <div className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">MP</div>
                                        <h3 className="font-medium text-blue-800 dark:text-blue-300">Mercado Pago</h3>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Access Token</label>
                                        <input
                                            type="password"
                                            value={mpAccessToken}
                                            onChange={(e) => setMpAccessToken(e.target.value)}
                                            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xs"
                                            placeholder="APP_USR-..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Public Key</label>
                                        <input
                                            type="text"
                                            value={mpPublicKey}
                                            onChange={(e) => setMpPublicKey(e.target.value)}
                                            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xs"
                                            placeholder="APP_USR-..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Uala */}
                            <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-lg border border-pink-100 dark:border-pink-800">
                                <div className="flex items-center space-x-3 mb-4">
                                    <input 
                                        type="checkbox" 
                                        checked={!!ualaClientId} 
                                        readOnly 
                                        className="h-4 w-4 text-pink-600 rounded border-gray-300 focus:ring-pink-500"
                                    />
                                    <div className="flex items-center space-x-2">
                                        {/* Mock Logo using CSS */}
                                        <div className="bg-pink-500 text-white text-xs font-bold px-2 py-1 rounded">Ualá</div>
                                        <h3 className="font-medium text-pink-800 dark:text-pink-300">Ualá Bis</h3>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Client ID</label>
                                        <input
                                            type="text"
                                            value={ualaClientId}
                                            onChange={(e) => setUalaClientId(e.target.value)}
                                            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xs"
                                            placeholder="Client ID"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Client Secret</label>
                                        <input
                                            type="password"
                                            value={ualaClientSecret}
                                            onChange={(e) => setUalaClientSecret(e.target.value)}
                                            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xs"
                                            placeholder="Client Secret"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Link
                            href="/admin/businesses"
                            className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            Cancelar
                        </Link>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading && <Loader2 className="animate-spin" size={18} />}
                            <span>Crear Negocio</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
