'use client';

import { useState } from 'react';
import { X, Store, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/components/AuthProvider';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'sonner';
import PushNotificationSettings from '@/components/PushNotificationSettings';
import { useFormValidation } from '@/hooks/useFormValidation';
import { validationSchemas } from '@/lib/validation';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { FormField } from '@/components/FormField';

interface NotificationPreferences {
  pushEnabled: boolean;
  soundEnabled: boolean;
  emailEnabled: boolean;
}

export default function DashboardSettingsPage() {
    const { profile } = useAuth();
    const [isEditBusinessOpen, setIsEditBusinessOpen] = useState(false);
    const businessForm = useFormValidation(validationSchemas.settings, { name: '' });
    const { values, change, errorFor, submit, isValid, submitting } = businessForm;
    const { preferences: prefs, loading: prefsLoading, update: updatePreference } = useNotificationPreferences(profile?.business_id);

    const handleOpenEditBusiness = async () => {
        if (!profile?.business_id) return;
        setIsEditBusinessOpen(true);
        const { data } = await supabase.from('businesses').select('name').eq('id', profile.business_id).single();
        if (data) change('name', data.name);
    };

    const handleSaveBusiness = async (e: React.FormEvent) => {
        await submit(e, async (normalized) => {
        try {
            const { error } = await supabase
                .from('businesses')
                .update({ name: normalized.name })
                .eq('id', profile?.business_id);
            
            if (error) throw error;
            setIsEditBusinessOpen(false);
            toast.success('Información actualizada correctamente');
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar');
        }
        });
    };

    const toggleNotification = async (key: keyof NotificationPreferences) => {
        if (key === 'emailEnabled') return;
        try {
            await updatePreference(key, !prefs[key]);
            toast.info(`Notificación ${key} ${!prefs[key] ? 'activada' : 'desactivada'}`);
        } catch (error) {
            console.error('Error saving notification preference:', error);
            toast.error('Error al guardar preferencia');
        }
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
                    
                    <PushNotificationSettings />
                    
                    <div className="mt-6 space-y-4 max-w-md">
                        {prefsLoading ? (
                            <div className="text-center py-4 text-sm text-gray-500">Cargando preferencias...</div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Alertas Visuales (Toast)</label>
                                    <button 
                                        onClick={() => toggleNotification('pushEnabled')}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${prefs.pushEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                    >
                                        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${prefs.pushEnabled ? 'translate-x-6' : ''}`} />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sonido de Notificación</label>
                                    <button 
                                        onClick={() => toggleNotification('soundEnabled')}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${prefs.soundEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                    >
                                        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${prefs.soundEnabled ? 'translate-x-6' : ''}`} />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notificaciones por Email</label>
                                        <p className="text-xs text-gray-500">Próximamente</p>
                                    </div>
                                    <button type="button" disabled aria-label="Notificaciones por Email, próximamente"
                                        className="w-12 h-6 rounded-full bg-gray-200 dark:bg-gray-700 opacity-60 cursor-not-allowed">
                                        <span className="block ml-1 w-4 h-4 rounded-full bg-white" />
                                    </button>
                                </div>
                            </>
                        )}
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
                            <FormField label="Nombre del Negocio" name="business-name" value={values.name} onChange={value => change('name', value)} onBlur={() => businessForm.blur('name')} error={errorFor('name')} maxLength={160} required />

                            <button 
                                type="submit"
                                disabled={!isValid || submitting}
                                className="w-full mt-6 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                            >
                                {submitting ? <Spinner size="sm" className="text-white" /> : 'Guardar Cambios'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
