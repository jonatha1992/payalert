// Hook para manejar notificaciones push del navegador
import { useState, useEffect, useCallback } from 'react';

interface PushSubscriptionState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UsePushNotificationsReturn extends PushSubscriptionState {
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    error: null,
  });

  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Verificar soporte y estado inicial
  useEffect(() => {
    const checkSupport = async () => {
      if (typeof window === 'undefined') {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Verificar soporte de notificaciones push
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setState({
          isSupported: false,
          isSubscribed: false,
          isLoading: false,
          error: 'Tu navegador no soporta notificaciones push',
        });
        return;
      }

      try {
        // Registrar service worker
        const reg = await navigator.serviceWorker.ready;
        setRegistration(reg);

        // Verificar si ya está suscrito
        const subscription = await reg.pushManager.getSubscription();

        setState({
          isSupported: true,
          isSubscribed: !!subscription,
          isLoading: false,
          error: null,
        });
      } catch {
        setState({
          isSupported: true,
          isSubscribed: false,
          isLoading: false,
          error: 'Error al verificar suscripción',
        });
      }
    };

    checkSupport();
  }, []);

  // Solicitar permiso de notificaciones
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, []);

  // Suscribirse a notificaciones push
  const subscribe = useCallback(async () => {
    if (!registration || !state.isSupported) {
      setState(prev => ({ ...prev, error: 'Push notifications no soportado' }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Solicitar permiso primero
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Permiso de notificaciones denegado',
        }));
        return;
      }

      // Obtener clave pública VAPID
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Configuración de push incompleta',
        }));
        return;
      }

      // Suscribirse
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      // Enviar suscripción al servidor
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });

      if (!response.ok) {
        throw new Error('Error al guardar suscripción');
      }

      setState(prev => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
        error: null,
      }));

      // Mostrar notificación de confirmación
      if (registration.active) {
        registration.active.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: 'Notificaciones activadas',
          body: 'Recibirás alertas cuando lleguen pagos a tu negocio',
        });
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Error al suscribirse',
      }));
    }
  }, [registration, state.isSupported, requestPermission]);

  // Desuscribirse de notificaciones push
  const unsubscribe = useCallback(async () => {
    if (!registration) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        // Notificar al servidor
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Error al desuscribirse',
      }));
    }
  }, [registration]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    requestPermission,
  };
}

// Utilidad para convertir clave VAPID
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}
