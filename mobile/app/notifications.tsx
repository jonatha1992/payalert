import { useState } from 'react';
import { ActivityIndicator, Alert, Button, Text, View } from 'react-native';
import { supabase } from '../src/auth';
import { registerPushDevice, revokePushDevice, showTestNotification } from '../src/push/devices';

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
export default function NotificationsScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const register = async () => {
    setBusy(true); setError(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('La sesión expiró. Inicia sesión nuevamente.');
      setToken(await registerPushDevice(session.access_token, baseUrl));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo registrar el dispositivo.'); }
    finally { setBusy(false); }
  };
  const revoke = async () => {
    if (!token) return;
    setBusy(true); setError(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('La sesión expiró. Inicia sesión nuevamente.');
      await revokePushDevice(token, session.access_token, baseUrl); setToken(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo dar de baja el dispositivo.'); }
    finally { setBusy(false); }
  };
  const test = async () => { try { await showTestNotification(); } catch (reason) { Alert.alert('No se pudo mostrar la prueba', reason instanceof Error ? reason.message : 'Error desconocido.'); } };
  return <View style={{ flex: 1, padding: 20, gap: 16 }}>
    <Text style={{ fontSize: 24, fontWeight: '700' }}>Notificaciones</Text>
    <Text>Estado: {token ? 'dispositivo registrado' : 'no registrado'}</Text>
    {token && <Text selectable>Token Expo: {token}</Text>}
    {error && <Text accessibilityRole="alert">{error}</Text>}
    {busy && <ActivityIndicator />}
    {!token ? <Button title="Activar notificaciones" disabled={busy} onPress={() => void register()} /> : <Button title="Dar de baja este dispositivo" disabled={busy} onPress={() => void revoke()} />}
    <Button title="Recibir notificación de prueba" disabled={busy} onPress={() => void test()} />
  </View>;
}
