import AsyncStorage from '@react-native-async-storage/async-storage';
import { createApiClient } from '../api/client';
import { supabase } from '../auth';
import { NotificationQueue, type QueueEntry } from './queue';
import type { PaymentHint } from './filter';

const key = 'payalert.payment-hints.v1';
const store = {
  async read(): Promise<QueueEntry[]> { return JSON.parse(await AsyncStorage.getItem(key) ?? '[]') as QueueEntry[]; },
  async write(entries: QueueEntry[]): Promise<void> { await AsyncStorage.setItem(key, JSON.stringify(entries)); },
};
const request = createApiClient(process.env.EXPO_PUBLIC_API_BASE_URL ?? '', async () => (await supabase.auth.getSession()).data.session?.access_token ?? null);
export const paymentHintQueue = new NotificationQueue(store, async (hint: PaymentHint) => {
  const result = await request<{ accepted: boolean }>('/api/mobile/payment-hints', { method: 'POST', body: JSON.stringify(hint) });
  if (!result.accepted) throw new Error('El servidor no aceptó el aviso.');
});
export async function notificationHistory(): Promise<QueueEntry[]> { return store.read(); }
