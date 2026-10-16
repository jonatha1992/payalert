import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

export async function registerPushDevice(accessToken: string, baseUrl: string, fetcher: typeof fetch = fetch): Promise<string> {
  if (!Device.isDevice) throw new Error('Las notificaciones push requieren un dispositivo Android físico.');
  const permission = await Notifications.getPermissionsAsync();
  const granted = permission.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) throw new Error('Permiso de notificaciones denegado.');
  await Notifications.setNotificationChannelAsync('default', { name: 'General', importance: Notifications.AndroidImportance.MAX });
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Falta el projectId de EAS para obtener el token push.');
  const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const response = await fetcher(`${baseUrl.replace(/\/+$/, '')}/api/push/devices`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform: 'android', expoPushToken }),
  });
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? `No se pudo registrar el dispositivo (${response.status}).`);
  return expoPushToken;
}

export async function revokePushDevice(token: string, accessToken: string, baseUrl: string, fetcher: typeof fetch = fetch): Promise<void> {
  const response = await fetcher(`${baseUrl.replace(/\/+$/, '')}/api/push/devices`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expoPushToken: token }),
  });
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? `No se pudo dar de baja el dispositivo (${response.status}).`);
}

export async function showTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({ content: { title: 'PayAlert', body: 'Notificación de prueba local.' }, trigger: null });
}
