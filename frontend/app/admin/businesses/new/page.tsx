'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';
import { useFormValidation } from '@/hooks/useFormValidation';
import { validationSchemas } from '@/lib/validation';
import { FormField } from '@/components/FormField';
import Link from 'next/link';

export default function NewBusinessPage() {
    const businessForm = useFormValidation(validationSchemas.newBusiness, { name: '', mpAccessToken: '', mpPublicKey: '', ualaClientId: '', ualaClientSecret: '' });
    const { values, change, errorFor, submit, isValid, submitting } = businessForm;
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        await submit(e, async (normalized) => {
        setError(null);

        try {
            await supabase.auth.getUser();

            const settings = {
                payments: {
                    mercado_pago: {
                        access_token: values.mpAccessToken,
                        public_key: values.mpPublicKey,
                        enabled: !!values.mpAccessToken
                    },
                    uala: {
                        client_id: values.ualaClientId,
                        client_secret: values.ualaClientSecret,
                        enabled: !!values.ualaClientId
                    }
                }
            };

            const { error } = await supabase
                .from('businesses')
                .insert([{ name: normalized.name, settings }]);

            if (error) throw error;

            router.push('/admin/businesses');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'No se pudo crear el negocio. Revisá los datos e intentá de nuevo.');
        }
        });
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Nuevo Negocio</h1>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <FormField label="Nombre del Negocio" name="name" value={values.name} onChange={value => change('name', value)} onBlur={() => businessForm.blur('name')} error={errorFor('name')} maxLength={160} placeholder="Ej. Mi Tienda Genial" required />

                    {error && (
                        <div role="alert" className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>
                    )}

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Configuración de Pagos</h2>
                        
                        <div className="space-y-4">
                            {/* Mercado Pago */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                                <div className="flex items-center space-x-3 mb-4">
                                    <input 
                                        type="checkbox" 
                                        checked={!!values.mpAccessToken}
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
                                            value={values.mpAccessToken}
                                            onChange={(e) => change('mpAccessToken', e.target.value)}
                                            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xs"
                                            placeholder="APP_USR-..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Public Key</label>
                                        <input
                                            type="text"
                                            value={values.mpPublicKey}
                                            onChange={(e) => change('mpPublicKey', e.target.value)}
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
                                        checked={!!values.ualaClientId}
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
                                            value={values.ualaClientId}
                                            onChange={(e) => change('ualaClientId', e.target.value)}
                                            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xs"
                                            placeholder="Client ID"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Client Secret</label>
                                        <input
                                            type="password"
                                            value={values.ualaClientSecret}
                                            onChange={(e) => change('ualaClientSecret', e.target.value)}
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
                            disabled={!isValid || submitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting && <Loader2 className="animate-spin" size={18} />}
                            <span>Crear Negocio</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
