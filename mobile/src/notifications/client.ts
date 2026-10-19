import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../auth';
import { NotificationQueue, type QueueEntry } from './queue';
import type { PaymentHint } from './filter';
import { createPaymentHintSender } from './sender';

const key = 'payalert.payment-hints.v1';
const store = {
  async read(): Promise<QueueEntry[]> { return JSON.parse(await AsyncStorage.getItem(key) ?? '[]') as QueueEntry[]; },
  async write(entries: QueueEntry[]): Promise<void> { await AsyncStorage.setItem(key, JSON.stringify(entries)); },
};
const sendHint = createPaymentHintSender(process.env.EXPO_PUBLIC_API_BASE_URL ?? '', async () => (await supabase.auth.getSession()).data.session?.access_token ?? null);
export const paymentHintQueue = new NotificationQueue(store, (hint: PaymentHint) => sendHint(hint));
export async function notificationHistory(): Promise<QueueEntry[]> { return store.read(); }
