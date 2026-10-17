'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/components/AuthProvider';
import { Store, Plus, Loader2, MapPin, Phone, Trash2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { useFormValidation } from '@/hooks/useFormValidation';
import { validationSchemas } from '@/lib/validation';
import { FormField } from '@/components/FormField';
import Link from 'next/link';

interface StoreData {
    id: string;
    name: string;
    address: string;
    phone: string;
    is_active: boolean;
}

export default function StoresPage() {
    const { profile } = useAuth();
    const [stores, setStores] = useState<StoreData[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchStores = useCallback(async () => {
        setLoading(true);
        if (!profile?.business_id) {
            setLoading(false);
            return;
        }
        
        try {
            const { data, error } = await supabase
                .from('stores')
                .select('*')
                .eq('business_id', profile.business_id)
                .order('created_at', { ascending: false }); // Added order by created_at

            if (error) throw error;
            setStores(data || []);
        } catch (error) {
            console.error('Error fetching stores:', error);
        } finally {
            setLoading(false);
        }
    }, [profile?.business_id]);

    useEffect(() => {
        fetchStores();
    }, [fetchStores]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const storeForm = useFormValidation(validationSchemas.store, { name: '', address: '', phone: '' });
    const { values: newStore, change, errorFor, submit, isValid, submitting: createLoading } = storeForm;

    // ... (keep useEffect for fetchStores)

    const [editingStoreId, setEditingStoreId] = useState<string | null>(null);

    const openEditModal = (store: StoreData) => {
        change('name', store.name); change('address', store.address); change('phone', store.phone);
        setEditingStoreId(store.id);
        setIsModalOpen(true);
    };

    const handleSaveStore = async (e: React.FormEvent) => {
        await submit(e, async (normalized) => {
        try {
            if (editingStoreId) {
                // Update existing
                const { error } = await supabase
                    .from('stores')
                    .update({
                        name: normalized.name,
                        address: normalized.address ?? '',
                        phone: normalized.phone ?? '',
                    })
                    .eq('id', editingStoreId);
                
                if (error) throw error;
                toast.success('Sucursal actualizada exitosamente');
            } else {
                // Create new
                const { error } = await supabase.from('stores').insert([{
                    business_id: profile?.business_id,
                    name: normalized.name,
                    address: normalized.address ?? '',
                    phone: normalized.phone ?? '',
                    is_active: true
                }]);

                if (error) throw error;
                toast.success('Sucursal creada exitosamente');
            }
            
            fetchStores();
            setIsModalOpen(false);
            change('name', ''); change('address', ''); change('phone', '');
            setEditingStoreId(null);
        } catch (error) {
            console.error(error);
            toast.error(editingStoreId ? 'Error al actualizar sucursal' : 'Error al crear sucursal');
        }
        });
    };

    const handleDeleteStore = async (storeId: string) => {
        // Use a simple confirm for now, or a toast with action. Native confirm is fine for "Are you sure?" but toast for result.
        if (!confirm('¿Estás seguro de eliminar esta sucursal? Esta acción no se puede deshacer.')) return;
        
        try {
            const { error } = await supabase
                .from('stores')
                .delete()
                .eq('id', storeId);

            if (error) throw error;
            fetchStores();
            toast.success('Sucursal eliminada');
        } catch (error) {
            console.error('Error deleting store:', error);
            toast.error('Error al eliminar sucursal');
        }
    };

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Store className="text-blue-600" size={32} />
                        Mis Sucursales
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">
                        Gestiona los puntos de venta de tu negocio.
                    </p>
                </div>
                <button 
                    onClick={() => {
                        setEditingStoreId(null);
                        change('name', ''); change('address', ''); change('phone', '');
                        setIsModalOpen(true);
                    }}
                    className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95 font-medium"
                >
                    <Plus size={20} />
                    <span>Nueva Sucursal</span>
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="animate-spin text-blue-600" size={40} />
                </div>
            ) : stores.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 text-center animate-in fade-in zoom-in duration-500">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-full mb-6">
                        <Store className="text-blue-500" size={48} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        No tienes sucursales registradas
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">
                        Comienza agregando tu primera sucursal para poder recibir pagos y gestionar tus empleados.
                    </p>
                    <button 
                         onClick={() => {
                            setEditingStoreId(null);
                            change('name', ''); change('address', ''); change('phone', '');
                            setIsModalOpen(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg active:scale-95"
                    >
                        Crear mi primera sucursal
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {stores.map((store) => (
                        <div key={store.id} className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-xl">
                                    <Store size={24} className="text-gray-600 dark:text-gray-300" />
                                </div>
                                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => openEditModal(store)}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteStore(store.id)}
                                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                            
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{store.name}</h3>
                            
                            <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                                <div className="flex items-center gap-2">
                                    <MapPin size={16} />
                                    <span>{store.address || 'Sin dirección'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Phone size={16} />
                                    <span>{store.phone || 'Sin teléfono'}</span>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${store.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700'}`}>
                                    {store.is_active ? 'Activa' : 'Inactiva'}
                                </span>
                                <Link 
                                    href={`/dashboard/stores/${store.id}`}
                                    className="text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline"
                                >
                                    Ver detalles
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Store Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 relative shadow-xl">
                        <button 
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X size={24} />
                        </button>
                        
                        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                            {editingStoreId ? 'Editar Sucursal' : 'Nueva Sucursal'}
                        </h2>
                        
                        <form onSubmit={handleSaveStore} className="space-y-4">
                            <FormField label="Nombre" name="name" value={newStore.name} onChange={value => change('name', value)} onBlur={() => storeForm.blur('name')} error={errorFor('name')} maxLength={80} placeholder="Ej. Sucursal Centro" required />
                            <FormField label="Dirección" name="address" value={newStore.address} onChange={value => change('address', value)} onBlur={() => storeForm.blur('address')} error={errorFor('address')} maxLength={200} placeholder="Av. Principal 123" />
                            <FormField label="Teléfono (opcional)" name="phone" type="tel" value={newStore.phone} onChange={value => change('phone', value)} onBlur={() => storeForm.blur('phone')} error={errorFor('phone')} maxLength={24} placeholder="+54 9 11..." />
                            <button type="submit" disabled={!isValid || createLoading} className="w-full mt-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center shadow-lg shadow-blue-600/20">
                                {createLoading ? <Loader2 className="animate-spin" /> : (editingStoreId ? 'Guardar Cambios' : 'Crear Sucursal')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
