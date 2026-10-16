import { describe, expect, it, vi } from 'vitest';
vi.mock('expo-device', () => ({ isDevice: true }));
vi.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'eas-id' } } } } }));
vi.mock('expo-notifications', () => ({
  getPermissionsAsync: vi.fn(async () => ({ granted: true })),
  requestPermissionsAsync: vi.fn(async () => ({ granted: true })),
  setNotificationChannelAsync: vi.fn(async () => undefined),
  getExpoPushTokenAsync: vi.fn(async () => ({ data: 'ExpoPushToken[abc]' })),
  scheduleNotificationAsync: vi.fn(async () => 'id'),
  AndroidImportance: { MAX: 5 },
}));
import * as Notifications from 'expo-notifications';
import { registerPushDevice, revokePushDevice, showTestNotification } from '../src/push/devices';

describe('push device registration', () => {
  beforeEach(() => vi.clearAllMocks());
  it('registers Android token with Bearer auth and returns its status token', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })) as unknown as typeof fetch;
    await expect(registerPushDevice('jwt', 'https://api.example/', fetcher)).resolves.toBe('ExpoPushToken[abc]');
    expect(fetcher).toHaveBeenCalledWith('https://api.example/api/push/devices', expect.objectContaining({
      method: 'POST', headers: { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'android', expoPushToken: 'ExpoPushToken[abc]' }),
    }));
  });
  it('rejects denied permission without registering', async () => {
    (Notifications.getPermissionsAsync as any).mockResolvedValueOnce({ granted: false });
    (Notifications.requestPermissionsAsync as any).mockResolvedValueOnce({ granted: false });
    const fetcher = vi.fn() as unknown as typeof fetch;
    await expect(registerPushDevice('jwt', 'https://api.example', fetcher)).rejects.toThrow('Permiso de notificaciones denegado.');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('revokes the exact token by authenticated DELETE and schedules a local test notification', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })) as unknown as typeof fetch;
    await revokePushDevice('ExpoPushToken[abc]', 'jwt', 'https://api.example', fetcher);
    expect(fetcher).toHaveBeenCalledWith('https://api.example/api/push/devices', expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ expoPushToken: 'ExpoPushToken[abc]' }) }));
    await showTestNotification();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ content: expect.objectContaining({ title: 'PayAlert' }), trigger: null }));
  });
});
