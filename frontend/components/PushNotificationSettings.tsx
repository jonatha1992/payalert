'use client';

import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Bell, BellOff, Check, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PushNotificationSettings() {
  const {
    isSupported,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const handleSubscribe = async () => {
    try {
      await subscribe();
      toast.success('Notificaciones activadas', {
        description: 'Recibirás alertas cuando lleguen pagos',
      });
    } catch {
      toast.error('Error al activar notificaciones');
    }
  };

  const handleUnsubscribe = async () => {
    try {
      await unsubscribe();
      toast.success('Notificaciones desactivadas');
    } catch {
      toast.error('Error al desactivar notificaciones');
    }
  };

  if (!isSupported) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="text-yellow-600 mt-0.5" size={20} />
          <div>
            <h3 className="font-medium text-yellow-900 dark:text-yellow-100">
              Notificaciones no soportadas
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Tu navegador no soporta notificaciones push. Intenta usar Chrome, Firefox o Edge.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4">
          <div className={`p-3 rounded-xl ${
            isSubscribed 
              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' 
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
          }`}>
            {isSubscribed ? <Bell size={24} /> : <BellOff size={24} />}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Notificaciones Push
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {isSubscribed 
                ? 'Recibirás notificaciones cuando lleguen pagos a tu negocio'
                : 'Activa las notificaciones para recibir alertas en tiempo real'
              }
            </p>
            {error && (
              <p className="text-sm text-red-500 mt-2">{error}</p>
            )}
          </div>
        </div>

        {isLoading ? (
          <button
            disabled
            className="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg flex items-center space-x-2"
          >
            <Loader2 size={18} className="animate-spin" />
            <span>Cargando...</span>
          </button>
        ) : isSubscribed ? (
          <button
            onClick={handleUnsubscribe}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
          >
            Desactivar
          </button>
        ) : (
          <button
            onClick={handleSubscribe}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <Bell size={18} />
            <span>Activar</span>
          </button>
        )}
      </div>

      {isSubscribed && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2 text-emerald-600">
            <Check size={16} />
            <span className="text-sm font-medium">Notificaciones activas</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            También recibirás notificaciones cuando la app esté cerrada
          </p>
        </div>
      )}
    </div>
  );
}
