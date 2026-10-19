import { useCallback, useEffect, useState } from 'react';
import { Button, ScrollView, Text, View, AppState } from 'react-native';
import { supabase } from '../src/auth';
import { filterNotification, type NativeNotification } from '../src/notifications/filter';
import { notificationEvents, notificationListener, drainNativeQueue } from '../src/notifications/native';
import { notificationHistory, paymentHintQueue } from '../src/notifications/client';
import type { QueueEntry } from '../src/notifications/queue';

export default function PaymentHintsScreen() {
  const [active, setActive] = useState(false);
  const [history, setHistory] = useState<QueueEntry[]>([]);
  const refresh = useCallback(async () => {
    setActive(Boolean(await notificationListener?.isEnabled()));
    setHistory(await notificationHistory());
    for (const notice of await drainNativeQueue()) {
      const hint = filterNotification(notice);
      if (hint) await paymentHintQueue.enqueue(hint);
    }
    if ((await supabase.auth.getSession()).data.session) await paymentHintQueue.flush();
    setHistory(await notificationHistory());
  }, []);
  useEffect(() => {
    void refresh();
    const subscription = notificationEvents?.addListener('notification', (notice: object) => {
      const hint = filterNotification(notice as NativeNotification);
      if (hint) void paymentHintQueue.enqueue(hint).then(refresh);
    });
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { subscription?.remove(); appState.remove(); };
  }, [refresh]);
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}><Text style={{ fontSize: 24, fontWeight: '700' }}>Avisos del celular</Text>
    <Text>PayAlert lee avisos de Mercado Pago y los manda para que el servidor los revise. No confirma pagos.</Text>
    <Text>Acceso a notificaciones: {active ? 'Activo' : 'Inactivo'}</Text>
    <Button title="Abrir ajustes de notificaciones" onPress={() => void notificationListener?.openSettings()} />
    <Button title="Reintentar envíos" onPress={() => void refresh()} />
    <Text style={{ fontSize: 18, fontWeight: '600' }}>Últimos avisos</Text>
    {history.slice(0, 20).map((entry) => <View key={entry.hint.notificationKey} style={{ gap: 4 }}><Text>{entry.hint.title || 'Aviso de Mercado Pago'}</Text><Text>{entry.status === 'sent' ? 'Enviado' : entry.status === 'error' ? 'Error' : 'Pendiente'}</Text></View>)}
  </ScrollView>;
}
