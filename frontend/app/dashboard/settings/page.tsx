'use client';

import { useState } from 'react';
import { Settings, X, Store, Bell, Check } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/components/AuthProvider';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'sonner';

export default function DashboardSettingsPage() {
    const { profile } = useAuth();
    const [isEditBusinessOpen, setIsEditBusinessOpen] = useState(false);
    const [businessName, setBusinessName] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Notification Settings
    const [notifications, setNotifications] = useState({
        sound: true,
        toast: true,
        email: false
    });

    const handleOpenEditBusiness = async () => {
        if (!profile?.business_id) return;
        setIsEditBusinessOpen(true);
        // Fetch current name
        const { data } = await supabase.from('businesses').select('name').eq('id', profile.business_id).single();
        if (data) setBusinessName(data.name);
    };

    const handleSaveBusiness = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase
                .from('businesses')
                .update({ name: businessName })
                .eq('id', profile?.business_id);
            
            if (error) throw error;
            setIsEditBusinessOpen(false);
            toast.success('Información actualizada correctamente');
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar');
        } finally {
            setLoading(false);
        }
    };

    const toggleNotification = (key: keyof typeof notifications) => {
        setNotifications(prev => {
            const newState = { ...prev, [key]: !prev[key] };
            toast.info(`Notificación ${key} ${newState[key] ? 'activada' : 'desactivada'}`);
            return newState;
        });
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Configuración</h1>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                <div className="p-6">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                            <Store size={20} />
                        </div>
                        <h2 className="text-lg font-medium text-gray-900 dark:text-white">Perfil de Negocio</h2>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Actualiza el nombre y la información visible de tu negocio.</p>
                    <button 
                        onClick={handleOpenEditBusiness}
                        className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center hover:underline"
                    >
                        Editar información →
                    </button>
                </div>
                
                <div className="p-6">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg text-purple-600 dark:text-purple-400">
                            <Bell size={20} />
                        </div>
                        <h2 className="text-lg font-medium text-gray-900 dark:text-white">Notificaciones</h2>
                    </div>
                    
                    <div className="space-y-4 max-w-md">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Alertas Visuales (Toast)</label>
                            <button 
                                onClick={() => toggleNotification('toast')}
                                className={`w-12 h-6 rounded-full transition-colors relative ${notifications.toast ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                            >
                                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${notifications.toast ? 'translate-x-6' : ''}`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sonido de Notificación</label>
                             <button 
                                onClick={() => toggleNotification('sound')}
                                className={`w-12 h-6 rounded-full transition-colors relative ${notifications.sound ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                            >
                                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${notifications.sound ? 'translate-x-6' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Business Modal */}
            {isEditBusinessOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 relative shadow-xl">
                        <button 
                            onClick={() => setIsEditBusinessOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X size={24} />
                        </button>
                        
                        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Editar Negocio</h2>
                        
                        <form onSubmit={handleSaveBusiness} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del Negocio</label>
                                <input 
                                    required
                                    type="text" 
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                                    value={businessName}
                                    onChange={e => setBusinessName(e.target.value)}
                                />
                            </div>

                            <button 
                                type="submit"
                                disabled={loading}
                                className="w-full mt-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                            >
                                {loading ? <Spinner size="sm" className="text-white" /> : 'Guardar Cambios'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
