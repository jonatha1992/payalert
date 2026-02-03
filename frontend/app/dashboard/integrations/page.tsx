'use client';

import { useState, useEffect } from 'react';
import { CreditCard, Wallet, X, Save, Eye, EyeOff, MapPin, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

interface Store {
    id: string;
    name: string;
}

interface PaymentToken {
    id: string;
    provider: 'mercado_pago' | 'uala';
    store_id: string | null;
    is_active: boolean;
    created_at: string;
    store?: { name: string };
    metadata?: any;
}

interface IntegrationConfig {
    provider: 'mercado_pago' | 'uala';
    title: string;
    fields: { key: string; label: string; type: 'text' | 'password' }[];
}

export default function IntegrationsPage() {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [stores, setStores] = useState<Store[]>([]);
    const [tokens, setTokens] = useState<PaymentToken[]>([]);
    
    // Modal State
    const [selectedProvider, setSelectedProvider] = useState<IntegrationConfig | null>(null);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [selectedStoreId, setSelectedStoreId] = useState<string>('');
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (profile?.business_id) {
            fetchData();
        }
    }, [profile]);

    const fetchData = async () => {
        try {
            const [storesRes, tokensRes] = await Promise.all([
                supabase.from('stores').select('id, name').eq('business_id', profile?.business_id),
                supabase.from('payment_tokens').select('*, store:stores(name)').eq('business_id', profile?.business_id)
            ]);

            if (storesRes.data) setStores(storesRes.data);
            if (tokensRes.data) setTokens(tokensRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Error al cargar integraciones');
        }
    };

    const handleOpenConfig = (provider: 'mercado_pago' | 'uala') => {
        if (provider === 'mercado_pago') {
            setSelectedProvider({
                provider: 'mercado_pago',
                title: 'Mercado Pago',
                fields: [
                    { key: 'access_token', label: 'Access Token', type: 'password' },
                    { key: 'public_key', label: 'Public Key', type: 'text' }
                ]
            });
        } else {
            setSelectedProvider({
                provider: 'uala',
                title: 'Ualá Bis',
                fields: [
                    { key: 'client_id', label: 'Client ID', type: 'text' },
                    { key: 'client_secret', label: 'Client Secret', type: 'password' },
                    { key: 'username', label: 'Username', type: 'text' },
                    { key: 'password', label: 'Password', type: 'password' }
                ]
            });
        }
        setFormData({});
        setSelectedStoreId('');
        setShowSecrets({});
    };

    const handleSave = async () => {
        if (!profile?.business_id || !selectedProvider) return;
        setLoading(true);

        try {
            // Build key value depending on form
            // For simplicity, we store the MAIN secret as 'token_value' and others in 'metadata'
            // MP: token_value = Access Token
            // Uala: token_value = Client Secret (or we might need a simpler mapping)
            
            let tokenValue = '';
            let metadata = {};

            if (selectedProvider.provider === 'mercado_pago') {
                tokenValue = formData['access_token'];
                metadata = { public_key: formData['public_key'] };
            } else {
                tokenValue = formData['client_secret'];
                metadata = { 
                    client_id: formData['client_id'],
                    username: formData['username'],
                    password: formData['password'] // Note: Storing password in metadata is not ideal security, but required for auth flow if no token exchange exists yet.
                };
            }

            if (!tokenValue) {
                toast.error('Por favor completa los campos requeridos');
                setLoading(false);
                return;
            }

            const { error } = await supabase
                .from('payment_tokens')
                .insert([{
                    business_id: profile.business_id,
                    provider: selectedProvider.provider,
                    token_type: 'access', // Default
                    token_value: tokenValue,
                    store_id: selectedStoreId || null,
                    metadata: metadata,
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }]);

            if (error) throw error;
            
            toast.success('Integración guardada exitosamente');
            await fetchData();
            setSelectedProvider(null);
        } catch (error: any) {
            console.error('Error saving integration:', error);
            toast.error('Error al guardar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteToken = async (id: string) => {
        if (!confirm('¿Eliminar esta integración? Dejarás de recibir alertas.')) return;
        try {
            const { error } = await supabase.from('payment_tokens').delete().eq('id', id);
            if (error) throw error;
            toast.success('Integración eliminada');
            fetchData();
        } catch (error: any) {
            toast.error('Error al eliminar');
        }
    };

    const getProviderName = (p: string) => p === 'mercado_pago' ? 'Mercado Pago' : 'Ualá Bis';

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Integraciones</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mercado Pago Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-4">
                            <div className="bg-blue-100 dark:bg-blue-900/30 w-12 h-12 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <Wallet size={24} />
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Mercado Pago</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                            Conecta cuentas de Mercado Pago para procesar cobros QR.
                        </p>
                    </div>
                    <button 
                        onClick={() => handleOpenConfig('mercado_pago')}
                        className="mt-6 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Agregar Cuenta
                    </button>
                </div>

                {/* Uala Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-start mb-4">
                            <div className="bg-pink-100 dark:bg-pink-900/30 w-12 h-12 rounded-lg flex items-center justify-center text-pink-600 dark:text-pink-400">
                                <CreditCard size={24} />
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Ualá Bis</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm">
                            Conecta terminales de Ualá Bis.
                        </p>
                    </div>
                    <button 
                         onClick={() => handleOpenConfig('uala')}
                        className="mt-6 w-full py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Agregar Cuenta
                    </button>
                </div>
            </div>

            {/* List of Active Integrations */}
            <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Cuentas Conectadas</h2>
                {tokens.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm italic">No tienes cuentas conectadas.</p>
                ) : (
                    <div className="grid gap-4">
                        {tokens.map(token => (
                            <div key={token.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm">
                                <div className="flex items-center space-x-4">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${token.provider === 'mercado_pago' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
                                        {token.provider === 'mercado_pago' ? <Wallet size={20} /> : <CreditCard size={20} />}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900 dark:text-white">{getProviderName(token.provider)}</h4>
                                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                            <MapPin size={14} className="mr-1" />
                                            {token.store?.name || 'Todas las Sucursales (General)'}
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleDeleteToken(token.id)}
                                    className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                    title="Eliminar integración"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Config Modal */}
            {selectedProvider && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 relative shadow-xl">
                        <button 
                            onClick={() => setSelectedProvider(null)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X size={24} />
                        </button>
                        
                        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                            Conectar {selectedProvider.title}
                        </h2>

                        <div className="space-y-4">
                            {/* Store Selector */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Asignar a Sucursal
                                </label>
                                <div className="relative">
                                    <MapPin size={18} className="absolute left-3 top-2.5 text-gray-400" />
                                    <select
                                        className="w-full pl-10 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                        value={selectedStoreId}
                                        onChange={e => setSelectedStoreId(e.target.value)}
                                    >
                                        <option value="">General (Todas)</option>
                                        {stores.map(store => (
                                            <option key={store.id} value={store.id}>{store.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Si seleccionas "General", esta cuenta procesará pagos no asignados a una sucursal específica.
                                </p>
                            </div>

                            {selectedProvider.fields.map((field) => (
                                <div key={field.key}>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {field.label}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={field.type === 'password' && showSecrets[field.key] ? 'text' : field.type}
                                            value={formData[field.key] || ''}
                                            onChange={(e) => setFormData({...formData, [field.key]: e.target.value})}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder={`Ingresa tu ${field.label}`}
                                        />
                                        {field.type === 'password' && (
                                            <button
                                                type="button"
                                                onClick={() => setShowSecrets(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                                            >
                                                {showSecrets[field.key] ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 flex space-x-3">
                            <button 
                                onClick={() => setSelectedProvider(null)}
                                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={loading}
                                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                            >
                                {loading && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />}
                                <span>Guardar Integración</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
